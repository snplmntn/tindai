import { getSupabaseAdminClient } from '../config/supabase';
import { buildTransactionVerificationPrompt } from '../services/gemini-transaction-prompt';
import {
  generateGeminiText,
  validateGeminiTransactionResponse,
} from '../services/gemini.service';
import type { GeminiTransactionVerification } from '../types/gemini';
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
  geminiConfidence?: number;
  geminiVerified?: boolean;
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

const GEMINI_TRANSACTION_VERIFICATION_SCHEMA = {
  type: 'object',
  required: ['intent', 'confidence', 'items', 'credit', 'notes'],
  properties: {
    intent: {
      type: 'string',
      enum: ['sale', 'restock', 'utang', 'unknown'],
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['spoken_name', 'matched_item_name', 'quantity_delta'],
        properties: {
          spoken_name: { type: 'string' },
          matched_item_name: { type: 'string' },
          quantity_delta: { type: 'number' },
        },
      },
    },
    credit: {
      type: 'object',
      required: ['is_utang', 'customer_name'],
      properties: {
        is_utang: { type: 'boolean' },
        customer_name: {
          type: ['string', 'null'],
        },
      },
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

function mapTransactionSource(source: VerifyTransactionInput['source']) {
  if (source === 'typed') {
    return 'manual';
  }

  return source;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function sumQuantityByItemName(
  items: Array<{
    itemName: string;
    quantityDelta: number;
  }>,
) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const key = item.itemName.trim();
    if (!key || item.quantityDelta === 0) {
      continue;
    }

    quantities.set(key, (quantities.get(key) ?? 0) + item.quantityDelta);
  }

  return quantities;
}

function sumGeminiQuantityByItemName(result: GeminiTransactionVerification) {
  const quantities = new Map<string, number>();

  for (const item of result.items) {
    const key = item.matched_item_name.trim();
    if (!key || item.quantity_delta === 0) {
      continue;
    }

    quantities.set(key, (quantities.get(key) ?? 0) + item.quantity_delta);
  }

  return quantities;
}

function getGeminiMovementType(intent: GeminiTransactionVerification['intent']) {
  if (intent === 'restock') {
    return 'restock';
  }

  if (intent === 'utang') {
    return 'utang_sale';
  }

  return 'sale';
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
          geminiVerified: false,
        });
        continue;
      }

      let geminiResult: GeminiTransactionVerification | null = null;
      let geminiConfidence: number | undefined;
      let geminiVerified = false;

      if (transaction.items.length > 0) {
        try {
          const prompt = buildTransactionVerificationPrompt({
            rawText: transaction.rawText,
            storeInventoryContext: (initialItems ?? []).map((item) => ({
              name: item.name,
              aliases: item.aliases?.length ? item.aliases : [item.name],
            })),
            localParse: transaction.localParse,
          });
          const geminiResponse = await generateGeminiText(prompt, {
            responseMimeType: 'application/json',
            responseSchema: GEMINI_TRANSACTION_VERIFICATION_SCHEMA,
          });

          if (geminiResponse) {
            geminiResult = validateGeminiTransactionResponse(geminiResponse);
            geminiConfidence = geminiResult.confidence;
            geminiVerified = geminiResult.confidence >= 0.7;
          }
        } catch (error) {
          console.warn('Gemini verification failed:', error);
        }
      }

      const verifiedCustomerName =
        geminiVerified && geminiResult?.credit.is_utang
          ? geminiResult.credit.customer_name ?? transaction.customerName
          : transaction.customerName;

      let customerId: string | null = null;
      if (
        (transaction.isUtang || (geminiVerified && geminiResult?.credit.is_utang)) &&
        verifiedCustomerName?.trim()
      ) {
        const customerName = verifiedCustomerName.trim();
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
          local_parse: {
            ...(transaction.localParse ?? {}),
            gemini_verification: geminiResult
              ? {
                  confidence: geminiResult.confidence,
                  verified: geminiVerified,
                  intent: geminiResult.intent,
                  notes: geminiResult.notes,
                  credit: geminiResult.credit,
                  items: geminiResult.items,
                }
              : null,
          },
          parser_source: transaction.parserSource,
          sync_status: 'verified',
          is_utang: geminiVerified ? Boolean(geminiResult?.credit.is_utang) : transaction.isUtang,
          occurred_at: transaction.occurredAt ?? nowIso,
          synced_at: nowIso,
          verified_at: nowIso,
        })
        .select('id')
        .single<{ id: string }>();

      if (createTransactionError || !createdTransaction) {
        throw new Error('Unable to create transaction.');
      }

      let localUtangAmount = 0;
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
        localUtangAmount += transaction.isUtang ? Math.abs(itemInput.quantityDelta) * unitPrice : 0;

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

      if (transaction.isUtang && customerId && localUtangAmount > 0) {
        const { error: createUtangError } = await supabase.from('utang_entries').insert({
          store_id: store.id,
          customer_id: customerId,
          transaction_id: createdTransaction.id,
          entry_type: 'credit_sale',
          amount_delta: localUtangAmount,
          note: transaction.rawText,
          client_mutation_id: transaction.clientMutationId,
          occurred_at: transaction.occurredAt ?? nowIso,
        });

        if (createUtangError) {
          throw new Error('Unable to create utang entry.');
        }
      }

      if (geminiVerified && geminiResult) {
        const localQuantities = sumQuantityByItemName(
          transaction.items.map((item) => ({
            itemName: item.itemName,
            quantityDelta: item.quantityDelta,
          })),
        );
        const geminiQuantities = sumGeminiQuantityByItemName(geminiResult);
        const correctionItemNames = new Set([
          ...Array.from(localQuantities.keys()),
          ...Array.from(geminiQuantities.keys()),
        ]);

        let correctionIndex = 0;
        for (const itemName of correctionItemNames) {
          const localQuantity = localQuantities.get(itemName) ?? 0;
          const geminiQuantity = geminiQuantities.get(itemName) ?? 0;
          const correctionDelta = geminiQuantity - localQuantity;

          if (correctionDelta === 0) {
            continue;
          }

          let inventoryItem = inventoryByName.get(normalizeName(itemName));

          if (!inventoryItem) {
            const { data: createdItem, error: createItemError } = await supabase
              .from('inventory_items')
              .insert({
                store_id: store.id,
                name: itemName,
                unit: 'pcs',
                price: 0,
                aliases: [],
              })
              .select('id, name, unit, price, aliases')
              .single<CloudInventoryItem>();

            if (createItemError || !createdItem) {
              throw new Error(`Unable to create correction item: ${itemName}.`);
            }

            inventoryItem = createdItem;
            inventoryByName.set(normalizeName(itemName), createdItem);
          }

          const { error: correctionMovementError } = await supabase.from('inventory_movements').insert({
            store_id: store.id,
            item_id: inventoryItem.id,
            transaction_id: createdTransaction.id,
            movement_type: 'gemini_correction',
            quantity_delta: correctionDelta,
            reason: transaction.rawText,
            created_by: ownerId,
            client_mutation_id: `${transaction.clientMutationId}:gemini:${correctionIndex}`,
            occurred_at: transaction.occurredAt ?? nowIso,
            metadata: {
              gemini_intent: geminiResult.intent,
              gemini_confidence: geminiResult.confidence,
              local_quantity_delta: localQuantity,
              verified_quantity_delta: geminiQuantity,
            },
          });

          if (correctionMovementError) {
            throw new Error('Unable to create Gemini correction movement.');
          }

          correctionIndex += 1;
        }

        const geminiUnitPriceByName = new Map<string, number>();
        for (const item of geminiResult.items) {
          const normalizedItemName = normalizeName(item.matched_item_name);
          const inventoryItem = inventoryByName.get(normalizedItemName);
          const localMatch = transaction.items.find(
            (transactionItem) =>
              normalizeName(transactionItem.itemName) === normalizedItemName ||
              normalizeName(transactionItem.matchedAlias ?? '') === normalizeName(item.spoken_name),
          );
          const unitPrice = Number(localMatch?.unitPrice) || Number(inventoryItem?.price) || 0;
          geminiUnitPriceByName.set(item.matched_item_name, unitPrice);
        }

        const geminiUtangAmount =
          geminiResult.credit.is_utang
            ? geminiResult.items.reduce(
                (total, item) =>
                  total + Math.abs(item.quantity_delta) * (geminiUnitPriceByName.get(item.matched_item_name) ?? 0),
                0,
              )
            : 0;
        const utangCorrectionAmount = geminiUtangAmount - localUtangAmount;

        if (customerId && utangCorrectionAmount !== 0) {
          const { error: utangAdjustmentError } = await supabase.from('utang_entries').insert({
            store_id: store.id,
            customer_id: customerId,
            transaction_id: createdTransaction.id,
            entry_type: 'adjustment',
            amount_delta: utangCorrectionAmount,
            note: `Gemini verification correction: ${transaction.rawText}`,
            client_mutation_id: `${transaction.clientMutationId}:utang-adjustment`,
            occurred_at: transaction.occurredAt ?? nowIso,
          });

          if (utangAdjustmentError) {
            throw new Error('Unable to create Gemini utang adjustment.');
          }
        }
      }

      results.push({
        clientMutationId: transaction.clientMutationId,
        status: 'synced',
        geminiConfidence,
        geminiVerified,
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
