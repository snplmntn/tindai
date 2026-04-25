import type { ParserResult } from '@/features/parser/offlineParser';

export type LedgerMutationSource = 'typed' | 'voice' | 'manual';

type LedgerDatabase = {
  runAsync: (source: string, params?: unknown[]) => Promise<unknown>;
  getFirstAsync: (source: string, params?: unknown[]) => Promise<unknown | null>;
};

type LedgerClock = {
  now: () => string;
  createId: (prefix: string) => string;
  createClientMutationId: () => string;
};

type InventoryRow = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  current_stock: number;
};

type CustomerRow = {
  id: string;
  name: string;
  utang_balance: number;
};

export class LocalLedgerService {
  private readonly clock: LedgerClock;

  constructor(
    private readonly database: LedgerDatabase,
    clock?: Partial<LedgerClock>,
  ) {
    this.clock = {
      now: () => new Date().toISOString(),
      createId: createLocalId,
      createClientMutationId: () => createLocalId('client-mutation'),
      ...clock,
    };
  }

  async applyReadyParserResult(
    storeId: string,
    parserResult: ParserResult,
    options?: { source?: LedgerMutationSource },
  ) {
    if (
      parserResult.status !== 'ready_to_apply' ||
      parserResult.items.length === 0 ||
      !['sale', 'restock', 'utang'].includes(parserResult.intent)
    ) {
      throw new Error('Only ready inventory-changing parser results can be applied locally.');
    }

    const now = this.clock.now();
    const transactionId = this.clock.createId('transaction');
    const clientMutationId = this.clock.createClientMutationId();
    const source = options?.source ?? 'typed';

    if (parserResult.credit.is_utang && !parserResult.credit.customer_name) {
      throw new Error('Utang entries require a customer name before applying locally.');
    }

    await this.database.runAsync('begin immediate', []);

    try {
      const customer = parserResult.credit.is_utang
        ? await this.getOrCreateCustomer(storeId, parserResult.credit.customer_name!, now)
        : null;

      await this.database.runAsync(
        `insert into transactions (
          id,
          store_id,
          client_mutation_id,
          raw_text,
          source,
          sync_status,
          parser_source,
          local_parse_json,
          is_utang,
          customer_id,
          created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          storeId,
          clientMutationId,
          parserResult.raw_text,
          source,
          'pending',
          'offline_rule_parser',
          JSON.stringify(parserResult),
          parserResult.credit.is_utang ? 1 : 0,
          customer?.id ?? null,
          now,
        ],
      );

      let creditAmount = 0;

      for (const parserItem of parserResult.items) {
        const item = await this.getInventoryItem(storeId, parserItem.item_id);
        const nextStock = item.current_stock + parserItem.quantity_delta;

        if (source === 'manual' && nextStock < 0) {
          throw new Error('Insufficient stock for manual adjustment.');
        }

        const unitPrice = item.price;
        const lineTotal = Math.abs(parserItem.quantity_delta) * unitPrice;
        const transactionItemId = this.clock.createId('transaction-item');
        const movementId = this.clock.createId('inventory-movement');

        creditAmount += parserResult.credit.is_utang ? lineTotal : 0;

        await this.database.runAsync(
          `insert into transaction_items (
            id,
            transaction_id,
            store_id,
            item_id,
            quantity_delta,
            unit_price,
            line_total,
            local_parse_json,
            created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionItemId,
            transactionId,
            storeId,
            parserItem.item_id,
            parserItem.quantity_delta,
            unitPrice,
            lineTotal,
            JSON.stringify(parserItem),
            now,
          ],
        );

        await this.database.runAsync(
          `insert into inventory_movements (
            id,
            store_id,
            item_id,
            transaction_id,
            movement_type,
            quantity_delta,
            client_mutation_id,
            note,
            created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            movementId,
            storeId,
            parserItem.item_id,
            transactionId,
            parserResult.intent === 'restock' ? 'restock' : 'sale',
            parserItem.quantity_delta,
            clientMutationId,
            parserResult.raw_text,
            now,
          ],
        );

        await this.database.runAsync(
          `update inventory_items
           set current_stock = ?, updated_at = ?
           where id = ? and store_id = ?`,
          [nextStock, now, parserItem.item_id, storeId],
        );
      }

      if (parserResult.credit.is_utang && customer) {
        await this.database.runAsync(
          `insert into utang_entries (
            id,
            store_id,
            customer_id,
            transaction_id,
            entry_type,
            amount,
            note,
            client_mutation_id,
            created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            this.clock.createId('utang-entry'),
            storeId,
            customer.id,
            transactionId,
            'credit',
            creditAmount,
            parserResult.raw_text,
            clientMutationId,
            now,
          ],
        );

        await this.database.runAsync(
          `update customers
           set utang_balance = ?, updated_at = ?
           where id = ? and store_id = ?`,
          [customer.utang_balance + creditAmount, now, customer.id, storeId],
        );
      }

      await this.database.runAsync('commit', []);
    } catch (caughtError) {
      await this.database.runAsync('rollback', []);
      throw caughtError;
    }

    return {
      transactionId,
      clientMutationId,
    };
  }

  private async getInventoryItem(storeId: string, itemId: string) {
    const item = (await this.database.getFirstAsync(
      `select id, store_id, name, price, current_stock
       from inventory_items
       where id = ? and store_id = ?
       limit 1`,
      [itemId, storeId],
    )) as InventoryRow | null;

    if (!item) {
      throw new Error(`Inventory item ${itemId} was not found locally.`);
    }

    return item;
  }

  private async getOrCreateCustomer(storeId: string, customerName: string, now: string): Promise<CustomerRow> {
    const existing = (await this.database.getFirstAsync(
      `select id, name, utang_balance
       from customers
       where store_id = ? and lower(name) = lower(?)
       limit 1`,
      [storeId, customerName],
    )) as CustomerRow | null;

    if (existing) {
      return existing;
    }

    const customerId = this.clock.createId('customer');
    await this.database.runAsync(
      `insert into customers (
        id,
        store_id,
        name,
        aliases_json,
        utang_balance,
        is_active,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, storeId, customerName, JSON.stringify([]), 0, 1, now, now],
    );

    return {
      id: customerId,
      name: customerName,
      utang_balance: 0,
    };
  }
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
