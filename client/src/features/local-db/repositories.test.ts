import { describe, expect, it, vi } from 'vitest';
import type * as SQLite from 'expo-sqlite';

import { CustomerRepository, TransactionRepository } from './repositories';

describe('TransactionRepository', () => {
  it('lists recent store transactions newest-first for dashboard history', async () => {
    const database = {
      getAllAsync: vi.fn().mockResolvedValue([
        {
          id: 'txn-2',
          store_id: 'store-1',
          raw_text: 'manual_adjust:+1 Coke Mismo',
          source: 'manual',
          sync_status: 'pending',
          parser_source: 'offline_rule_parser',
          local_parse_json: '{"intent":"restock"}',
          is_utang: 0,
          created_at: '2026-04-25T12:10:00.000Z',
          primary_item_name: 'Coke Mismo',
          primary_quantity_delta: 1,
        },
        {
          id: 'txn-1',
          store_id: 'store-1',
          raw_text: 'Nakabenta ako ng dalawang Coke Mismo.',
          source: 'voice',
          sync_status: 'pending',
          parser_source: 'offline_rule_parser',
          local_parse_json: '{"intent":"sale"}',
          is_utang: 0,
          created_at: '2026-04-25T12:00:00.000Z',
          primary_item_name: 'Coke Mismo',
          primary_quantity_delta: -2,
        },
      ]),
    } as unknown as SQLite.SQLiteDatabase;

    const repository = new TransactionRepository(database);
    const rows = await repository.listRecentTransactionsForStore('store-1');

    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('from transactions'),
      ['store-1', 20],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'txn-2',
        source: 'manual',
        rawText: 'manual_adjust:+1 Coke Mismo',
        primaryItemName: 'Coke Mismo',
        primaryQuantityDelta: 1,
      }),
      expect.objectContaining({
        id: 'txn-1',
        source: 'voice',
        primaryItemName: 'Coke Mismo',
        primaryQuantityDelta: -2,
      }),
    ]);
  });
});

describe('CustomerRepository', () => {
  it('creates a local customer when no active match exists', async () => {
    const database = {
      getFirstAsync: vi.fn().mockResolvedValue(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    } as unknown as SQLite.SQLiteDatabase;

    const repository = new CustomerRepository(database);
    const customer = await repository.createCustomerForStore('store-1', 'Mang Juan');

    expect(database.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('from customers'), [
      'store-1',
      'Mang Juan',
    ]);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('insert into customers'),
      expect.arrayContaining([customer.id, 'store-1', 'Mang Juan']),
    );
    expect(customer.name).toBe('Mang Juan');
    expect(customer.storeId).toBe('store-1');
  });

  it('returns existing active customer when a case-insensitive match exists', async () => {
    const database = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: 'customer-1',
        store_id: 'store-1',
        name: 'Mang Juan',
        utang_balance: 150,
      }),
      runAsync: vi.fn(),
    } as unknown as SQLite.SQLiteDatabase;

    const repository = new CustomerRepository(database);
    const customer = await repository.createCustomerForStore('store-1', 'mang juan');

    expect(database.runAsync).not.toHaveBeenCalled();
    expect(customer).toEqual({
      id: 'customer-1',
      storeId: 'store-1',
      name: 'Mang Juan',
      utangBalance: 150,
    });
  });
});
