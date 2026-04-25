import type * as SQLite from 'expo-sqlite';

import type { LocalInventoryItem, LocalStore } from './types';

type StoreRow = {
  id: string;
  owner_user_id: string;
  name: string;
  currency_code: string;
  timezone: string;
  updated_at: string;
};

type InventoryItemRow = {
  id: string;
  store_id: string;
  name: string;
  aliases_json: string;
  unit: string;
  price: number;
  current_stock: number;
  low_stock_threshold: number;
  updated_at: string;
};

export class StoreRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async upsertStore(store: LocalStore) {
    await this.database.runAsync(
      `insert into stores (id, owner_user_id, name, currency_code, timezone, updated_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         owner_user_id = excluded.owner_user_id,
         name = excluded.name,
         currency_code = excluded.currency_code,
         timezone = excluded.timezone,
         updated_at = excluded.updated_at`,
      [store.id, store.ownerId, store.name, store.currencyCode, store.timezone, store.updatedAt],
    );
  }

  async getLatestStore(): Promise<LocalStore | null> {
    const row = await this.database.getFirstAsync<StoreRow>(
      `select id, owner_user_id, name, currency_code, timezone, updated_at
       from stores
       order by updated_at desc
       limit 1`,
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      ownerId: row.owner_user_id,
      name: row.name,
      currencyCode: row.currency_code,
      timezone: row.timezone,
      updatedAt: row.updated_at,
    };
  }
}

export class InventoryRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async replaceInventoryForStore(storeId: string, items: LocalInventoryItem[]) {
    await this.database.runAsync('delete from inventory_items where store_id = ?', [storeId]);

    for (const item of items) {
      await this.database.runAsync(
        `insert into inventory_items (
          id,
          store_id,
          name,
          aliases_json,
          unit,
          price,
          current_stock,
          low_stock_threshold,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.storeId,
          item.name,
          JSON.stringify(item.aliases),
          item.unit,
          item.price,
          item.currentStock,
          item.lowStockThreshold,
          item.updatedAt,
        ],
      );
    }
  }

  async listInventoryForStore(storeId: string): Promise<LocalInventoryItem[]> {
    const rows = await this.database.getAllAsync<InventoryItemRow>(
      `select id, store_id, name, aliases_json, unit, price, current_stock, low_stock_threshold, updated_at
       from inventory_items
       where store_id = ?
       order by name asc`,
      [storeId],
    );

    return rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      aliases: JSON.parse(row.aliases_json) as string[],
      unit: row.unit,
      price: row.price,
      currentStock: row.current_stock,
      lowStockThreshold: row.low_stock_threshold,
      updatedAt: row.updated_at,
    }));
  }
}
