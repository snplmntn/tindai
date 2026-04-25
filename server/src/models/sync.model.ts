import { getSupabaseAdminClient } from '../config/supabase';
import { getStoreByOwnerId } from './store.model';

export type VerifyTransactionItemInput = {
  itemId?: string;
  itemName: string;
  matchedAlias?: string;
  quantityDelta: number;
  unitPrice: number;
  unit?: string;
};

export type VerifyTransactionInput = {
  clientMutationId: string;
  rawText: string;
  source: 'voice' | 'typed' | 'manual';
  parserSource: string;
  localParse: Record<string, unknown> | null;
  isUtang: boolean;
  customerName?: string;
  occurredAt?: string;
  items: VerifyTransactionItemInput[];
};

export type VerifyTransactionResult = {
  clientMutationId: string;
  status: 'synced' | 'needs_review' | 'failed';
  reason?: string;
};

type CloudInventoryItem = {
  id: string;
  name: string;
  unit: string;
  price: number;
  aliases: string[] | null;
};

type CloudCustomer = {
  id: string;
  display_name: string;
};

function mapTransactionSource(source: VerifyTransactionInput['source']) {
  if (source === 'typed') {
    return 'manual';
  }

  return source;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export async function verifyTransactionsForOwner(
  ownerId: string,
  transactions: VerifyTransactionInput[],
): Promise<{ storeId: string; results: VerifyTransactionResult[] }> {
  const store = await getStoreByOwnerId(ownerId);
  if (!store) {
    throw new Error('Store not found.');
  }

  const supabase = getSupabaseAdminClient();
  const { data: initialItems, error: initialItemsError } = await supabase
    .from('inventory_items')
    .select('id, name, unit, price, aliases')
    .eq('store_id', store.id)
    .is('archived_at', null)
    .returns<CloudInventoryItem[]>();

  if (initialItemsError) {
    throw new Error('Unable to load store inventory.');
  }

  const inventoryByName = new Map<string, CloudInventoryItem>();
  for (const item of initialItems ?? []) {
    inventoryByName.set(normalizeName(item.name), item);
  }

  const results: VerifyTransactionResult[] = [];

  for (const transaction of transactions) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from('transactions')
        .select('id')
        .eq('store_id', store.id)
        .eq('client_mutation_id', transaction.clientMutationId)
        .maybeSingle<{ id: string }>();

      if (existingError) {
        throw new Error('Unable to verify transaction idempotency.');
      }

      if (existing) {
        results.push({
          clientMutationId: transaction.clientMutationId,
          status: 'synced',
        });
        continue;
      }

      let customerId: string | null = null;
      if (transaction.isUtang && transaction.customerName?.trim()) {
        const customerName = transaction.customerName.trim();
        const { data: existingCustomer, error: existingCustomerError } = await supabase
          .from('customers')
          .select('id, display_name')
          .eq('store_id', store.id)
          .ilike('display_name', customerName)
          .maybeSingle<CloudCustomer>();

        if (existingCustomerError) {
          throw new Error('Unable to load customer.');
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: createdCustomer, error: createCustomerError } = await supabase
            .from('customers')
            .insert({
              store_id: store.id,
              display_name: customerName,
            })
            .select('id')
            .single<{ id: string }>();

          if (createCustomerError || !createdCustomer) {
            throw new Error('Unable to create customer.');
          }

          customerId = createdCustomer.id;
        }
      }

      const nowIso = new Date().toISOString();
      const { data: createdTransaction, error: createTransactionError } = await supabase
        .from('transactions')
        .insert({
          store_id: store.id,
          created_by: ownerId,
          customer_id: customerId,
          client_mutation_id: transaction.clientMutationId,
          source: mapTransactionSource(transaction.source),
          raw_text: transaction.rawText,
          local_parse: transaction.localParse ?? {},
          parser_source: transaction.parserSource,
          sync_status: 'verified',
          is_utang: transaction.isUtang,
          occurred_at: transaction.occurredAt ?? nowIso,
          synced_at: nowIso,
          verified_at: nowIso,
        })
        .select('id')
        .single<{ id: string }>();

      if (createTransactionError || !createdTransaction) {
        throw new Error('Unable to create transaction.');
      }

      let utangAmount = 0;
      for (const itemInput of transaction.items) {
        if (!itemInput.itemName?.trim() || itemInput.quantityDelta === 0) {
          continue;
        }

        const normalizedItemName = normalizeName(itemInput.itemName);
        let inventoryItem = inventoryByName.get(normalizedItemName);

        if (!inventoryItem) {
          const { data: createdItem, error: createItemError } = await supabase
            .from('inventory_items')
            .insert({
              store_id: store.id,
              name: itemInput.itemName.trim(),
              unit: itemInput.unit?.trim() || 'pcs',
              price: itemInput.unitPrice,
              aliases: itemInput.matchedAlias ? [itemInput.matchedAlias] : [],
            })
            .select('id, name, unit, price, aliases')
            .single<CloudInventoryItem>();

          if (createItemError || !createdItem) {
            throw new Error(`Unable to create inventory item: ${itemInput.itemName}.`);
          }

          inventoryItem = createdItem;
          inventoryByName.set(normalizedItemName, createdItem);
        }

        const unitPrice = Number(itemInput.unitPrice) || Number(inventoryItem.price) || 0;
        utangAmount += transaction.isUtang ? Math.abs(itemInput.quantityDelta) * unitPrice : 0;

        const { data: createdTransactionItem, error: createTransactionItemError } = await supabase
          .from('transaction_items')
          .insert({
            transaction_id: createdTransaction.id,
            store_id: store.id,
            item_id: inventoryItem.id,
            spoken_name: itemInput.matchedAlias ?? itemInput.itemName,
            quantity_delta: itemInput.quantityDelta,
            unit_price: unitPrice,
            item_snapshot: {
              name: inventoryItem.name,
              unit: inventoryItem.unit,
            },
          })
          .select('id')
          .single<{ id: string }>();

        if (createTransactionItemError || !createdTransactionItem) {
          throw new Error('Unable to create transaction item.');
        }

        const movementType = transaction.isUtang
          ? 'utang_sale'
          : itemInput.quantityDelta > 0
            ? 'restock'
            : 'sale';

        const { error: createMovementError } = await supabase.from('inventory_movements').insert({
          store_id: store.id,
          item_id: inventoryItem.id,
          transaction_id: createdTransaction.id,
          transaction_item_id: createdTransactionItem.id,
          movement_type: movementType,
          quantity_delta: itemInput.quantityDelta,
          reason: transaction.rawText,
          created_by: ownerId,
          occurred_at: transaction.occurredAt ?? nowIso,
        });

        if (createMovementError) {
          throw new Error('Unable to create inventory movement.');
        }
      }

      if (transaction.isUtang && customerId && utangAmount > 0) {
        const { error: createUtangError } = await supabase.from('utang_entries').insert({
          store_id: store.id,
          customer_id: customerId,
          transaction_id: createdTransaction.id,
          entry_type: 'credit_sale',
          amount_delta: utangAmount,
          note: transaction.rawText,
          client_mutation_id: transaction.clientMutationId,
          occurred_at: transaction.occurredAt ?? nowIso,
        });

        if (createUtangError) {
          throw new Error('Unable to create utang entry.');
        }
      }

      results.push({
        clientMutationId: transaction.clientMutationId,
        status: 'synced',
      });
    } catch (error) {
      results.push({
        clientMutationId: transaction.clientMutationId,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Unknown sync failure.',
      });
    }
  }

  return {
    storeId: store.id,
    results,
  };
}
