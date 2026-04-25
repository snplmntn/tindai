import { describe, expect, it, vi } from 'vitest';
import type * as SQLite from 'expo-sqlite';

import { AppStateRepository, CustomerRepository, InventoryRepository, TransactionRepository } from './repositories';

describe('AppStateRepository', () => {
  it('initializes singleton app state safely when multiple callers race', async () => {
    const getFirstAsync = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        mode: 'guest',
        guest_device_id: 'guest-device-1',
        active_store_id: null,
        onboarding_completed: 0,
        auth_mode: 'magic_link',
        microphone_permission: 'pending',
        storage_permission: 'pending',
        tutorial_shown: 0,
        guest_converted: 0,
        migration_status: 'not_started',
        migration_owner_user_id: null,
        pending_claim_owner_user_id: null,
        last_migration_error: null,
        last_bootstrap_at: null,
        updated_at: '2026-04-25T00:00:00.000Z',
      });

    const runAsync = vi.fn().mockResolvedValue(undefined);
    const database = { getFirstAsync, runAsync } as unknown as SQLite.SQLiteDatabase;

    const repository = new AppStateRepository(database);
    const state = await repository.getOrCreateState();

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('on conflict(id) do nothing'),
      expect.any(Array),
    );
    expect(state.mode).toBe('guest');
    expect(state.guestDeviceId).toBe('guest-device-1');
  });
});

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

  it('lists active utang ledger customers with item summaries and latest activity', async () => {
    const database = {
      getAllAsync: vi.fn().mockResolvedValue([
        {
          customer_id: 'customer-1',
          customer_name: 'Mang Juan',
          utang_balance: 150,
          entry_count: 2,
          latest_entry_at: '2026-04-25T12:00:00.000Z',
          item_summary: '2x Coke Mismo, 1x Lucky 7 Sardines',
        },
      ]),
    } as unknown as SQLite.SQLiteDatabase;

    const repository = new CustomerRepository(database);
    const customers = await repository.listUtangLedgerCustomersForStore('store-1');

    expect(database.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('from customers c'), ['store-1']);
    expect(customers).toEqual([
      {
        customerId: 'customer-1',
        customerName: 'Mang Juan',
        utangBalance: 150,
        entryCount: 2,
        latestEntryAt: '2026-04-25T12:00:00.000Z',
        itemSummary: '2x Coke Mismo, 1x Lucky 7 Sardines',
      },
    ]);
  });

  it('lists recent utang entries with customer and item details', async () => {
    const database = {
      getAllAsync: vi.fn().mockResolvedValue([
        {
          entry_id: 'utang-1',
          customer_id: 'customer-1',
          customer_name: 'Mang Juan',
          amount: 40,
          note: 'Kumuha si Mang Juan ng dalawang Coke, ilista mo muna.',
          created_at: '2026-04-25T12:00:00.000Z',
          sync_status: 'pending',
          item_summary: '2x Coke Mismo',
        },
      ]),
    } as unknown as SQLite.SQLiteDatabase;

    const repository = new CustomerRepository(database);
    const entries = await repository.listRecentUtangEntriesForStore('store-1');

    expect(database.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('from utang_entries ue'), ['store-1', 20]);
    expect(entries).toEqual([
      {
        entryId: 'utang-1',
        customerId: 'customer-1',
        customerName: 'Mang Juan',
        amount: 40,
        note: 'Kumuha si Mang Juan ng dalawang Coke, ilista mo muna.',
        createdAt: '2026-04-25T12:00:00.000Z',
        syncStatus: 'pending',
        itemSummary: '2x Coke Mismo',
      },
    ]);
  });
});

describe('InventoryRepository', () => {
  it('creates a local inventory item with normalized aliases', async () => {
    const database = {
      getFirstAsync: vi.fn().mockResolvedValue(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    } as unknown as SQLite.SQLiteDatabase;

    const repository = new InventoryRepository(database);
    const item = await repository.createInventoryItemForStore({
      storeId: 'store-1',
      name: 'Coke Mismo',
      aliases: ['Coke', 'coke mismo'],
      unit: 'pcs',
      cost: 12,
      price: 20,
      currentStock: 0,
      lowStockThreshold: 5,
    });

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('insert into inventory_items'),
      expect.arrayContaining([item.id, 'store-1', 'Coke Mismo']),
    );
    expect(item.aliases).toEqual(['coke mismo', 'coke']);
    expect(item.cost).toBe(12);
  });
});
