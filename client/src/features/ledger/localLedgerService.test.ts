import { describe, expect, it, vi } from 'vitest';

import { LocalLedgerService } from './localLedgerService';
import type { ParserResult } from '@/features/parser/offlineParser';

function createDatabase() {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const database = {
    runAsync: vi.fn((sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      return Promise.resolve();
    }),
    getFirstAsync: vi.fn(<T,>(sql: string, params: unknown[] = []): Promise<T | null> => {
      if (sql.includes('from customers')) {
        return Promise.resolve(null);
      }

      if (sql.includes('from inventory_items')) {
        return Promise.resolve({
          id: params[0],
          store_id: 'store-1',
          name: params[0] === 'item-coke' ? 'Coke Mismo' : 'Safeguard',
          aliases_json: '[]',
          unit: 'pcs',
          price: params[0] === 'item-coke' ? 20 : 25,
          current_stock: params[0] === 'item-coke' ? 12 : 8,
          low_stock_threshold: 4,
          updated_at: '2026-04-25T00:00:00.000Z',
        } as T);
      }

      return Promise.resolve(null);
    }),
  };

  return { database, statements };
}

const readySale: ParserResult = {
  raw_text: 'Nakabenta ako ng dalawang Coke Mismo.',
  normalized_text: 'nakabenta ako ng 2 coke mismo',
  intent: 'sale',
  confidence: 0.95,
  status: 'ready_to_apply',
  items: [
    {
      item_id: 'item-coke',
      item_name: 'Coke Mismo',
      matched_alias: 'coke mismo',
      quantity: 2,
      quantity_delta: -2,
      unit: 'pcs',
      confidence: 0.95,
    },
  ],
  credit: { is_utang: false },
  notes: [],
};

describe('LocalLedgerService', () => {
  it('writes transaction, item, movement, and current stock cache for a ready sale', async () => {
    const { database, statements } = createDatabase();
    const service = new LocalLedgerService(database, {
      now: () => '2026-04-25T10:00:00.000Z',
      createId: (prefix) => `${prefix}-id`,
      createClientMutationId: () => 'client-mutation-1',
    });

    const result = await service.applyReadyParserResult('store-1', readySale);

    expect(result).toEqual({
      transactionId: 'transaction-id',
      clientMutationId: 'client-mutation-1',
    });
    expect(statements.map((statement) => statement.sql)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('insert into transactions'),
        expect.stringContaining('insert into transaction_items'),
        expect.stringContaining('insert into inventory_movements'),
        expect.stringContaining('update inventory_items'),
      ]),
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('insert into transactions'),
      expect.arrayContaining(['transaction-id', 'store-1', 'client-mutation-1', readySale.raw_text]),
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('update inventory_items'),
      expect.arrayContaining([10, '2026-04-25T10:00:00.000Z', 'item-coke', 'store-1']),
    );
  });

  it('creates customer and utang entry for ready credit sale without calling sync or AI', async () => {
    const { database } = createDatabase();
    const service = new LocalLedgerService(database, {
      now: () => '2026-04-25T10:00:00.000Z',
      createId: (prefix) => `${prefix}-id`,
      createClientMutationId: () => 'client-mutation-utang',
    });
    const readyUtang: ParserResult = {
      ...readySale,
      raw_text: 'Kumuha si Mang Juan ng dalawang Coke, ilista mo muna.',
      normalized_text: 'kumuha si mang juan ng 2 coke ilista mo muna',
      intent: 'utang',
      credit: { is_utang: true, customer_name: 'Mang Juan' },
    };

    await service.applyReadyParserResult('store-1', readyUtang);

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('insert into customers'),
      expect.arrayContaining(['customer-id', 'store-1', 'Mang Juan']),
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('insert into utang_entries'),
      expect.arrayContaining(['utang-entry-id', 'store-1', 'customer-id', 'transaction-id', 'credit', 40]),
    );
  });

  it('rejects question and confirmation results because they must not mutate inventory', async () => {
    const { database } = createDatabase();
    const service = new LocalLedgerService(database);

    await expect(
      service.applyReadyParserResult('store-1', {
        ...readySale,
        intent: 'question',
        status: 'needs_confirmation',
        items: [],
      }),
    ).rejects.toThrow('Only ready inventory-changing parser results can be applied locally.');
    expect(database.runAsync).not.toHaveBeenCalled();
  });
});
