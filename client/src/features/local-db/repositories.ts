import type * as SQLite from 'expo-sqlite';

import type {
  LocalAppState,
  LocalInventoryItem,
  LocalStore,
  LocalTransactionSummary,
  MigrationStatus,
} from './types';

type AppStateRow = {
  mode: 'guest' | 'authenticated';
  guest_device_id: string;
  active_store_id: string | null;
  migration_status: MigrationStatus;
  migration_owner_user_id: string | null;
  pending_claim_owner_user_id: string | null;
  last_migration_error: string | null;
  last_bootstrap_at: string | null;
  updated_at: string;
};

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

type TransactionSummaryRow = {
  id: string;
  store_id: string;
  raw_text: string;
  source: 'voice' | 'typed' | 'manual';
  sync_status: string;
  parser_source: string;
  local_parse_json: string | null;
  primary_item_name: string | null;
  primary_quantity_delta: number | null;
  is_utang: number;
  created_at: string;
};

type PendingTransactionRow = {
  id: string;
  client_mutation_id: string;
  raw_text: string;
  source: 'voice' | 'typed' | 'manual';
  parser_source: string;
  local_parse_json: string | null;
  is_utang: number;
  created_at: string;
  customer_name: string | null;
};

type PendingTransactionItemRow = {
  item_id: string;
  quantity_delta: number;
  unit_price: number;
  spoken_name: string | null;
  item_name: string | null;
  unit: string | null;
};

export type PendingTransactionForSync = {
  id: string;
  clientMutationId: string;
  rawText: string;
  source: 'voice' | 'typed' | 'manual';
  parserSource: string;
  localParse: Record<string, unknown> | null;
  isUtang: boolean;
  customerName?: string;
  occurredAt: string;
  items: Array<{
    itemId?: string;
    itemName: string;
    matchedAlias?: string;
    quantityDelta: number;
    unitPrice: number;
    unit?: string;
  }>;
};

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapAppState(row: AppStateRow): LocalAppState {
  return {
    mode: row.mode,
    guestDeviceId: row.guest_device_id,
    activeStoreId: row.active_store_id,
    migrationStatus: row.migration_status,
    migrationOwnerUserId: row.migration_owner_user_id,
    pendingClaimOwnerUserId: row.pending_claim_owner_user_id,
    lastMigrationError: row.last_migration_error,
    lastBootstrapAt: row.last_bootstrap_at,
    updatedAt: row.updated_at,
  };
}

export class AppStateRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async getOrCreateState(): Promise<LocalAppState> {
    const row = await this.database.getFirstAsync<AppStateRow>(
      `select mode, guest_device_id, active_store_id, migration_status, migration_owner_user_id,
              pending_claim_owner_user_id, last_migration_error, last_bootstrap_at, updated_at
       from app_state
       where id = 1`,
    );

    if (row) {
      return mapAppState(row);
    }

    const guestDeviceId = createLocalId('guest-device');
    const now = new Date().toISOString();

    await this.database.runAsync(
      `insert into app_state (id, mode, guest_device_id, migration_status, updated_at)
       values (1, 'guest', ?, 'not_started', ?)`,
      [guestDeviceId, now],
    );

    const created = await this.database.getFirstAsync<AppStateRow>(
      `select mode, guest_device_id, active_store_id, migration_status, migration_owner_user_id,
              pending_claim_owner_user_id, last_migration_error, last_bootstrap_at, updated_at
       from app_state
       where id = 1`,
    );

    if (!created) {
      throw new Error('Failed to initialize app state.');
    }

    return mapAppState(created);
  }

  async updateState(patch: {
    mode?: 'guest' | 'authenticated';
    activeStoreId?: string | null;
    migrationStatus?: MigrationStatus;
    migrationOwnerUserId?: string | null;
    pendingClaimOwnerUserId?: string | null;
    lastMigrationError?: string | null;
    lastBootstrapAt?: string | null;
  }) {
    await this.getOrCreateState();

    const updates: string[] = [];
    const params: unknown[] = [];

    if (patch.mode !== undefined) {
      updates.push('mode = ?');
      params.push(patch.mode);
    }
    if (patch.activeStoreId !== undefined) {
      updates.push('active_store_id = ?');
      params.push(patch.activeStoreId);
    }
    if (patch.migrationStatus !== undefined) {
      updates.push('migration_status = ?');
      params.push(patch.migrationStatus);
    }
    if (patch.migrationOwnerUserId !== undefined) {
      updates.push('migration_owner_user_id = ?');
      params.push(patch.migrationOwnerUserId);
    }
    if (patch.pendingClaimOwnerUserId !== undefined) {
      updates.push('pending_claim_owner_user_id = ?');
      params.push(patch.pendingClaimOwnerUserId);
    }
    if (patch.lastMigrationError !== undefined) {
      updates.push('last_migration_error = ?');
      params.push(patch.lastMigrationError);
    }
    if (patch.lastBootstrapAt !== undefined) {
      updates.push('last_bootstrap_at = ?');
      params.push(patch.lastBootstrapAt);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(1);
    await this.database.runAsync(
      `update app_state set ${updates.join(', ')} where id = ?`,
      params as SQLite.SQLiteBindParams,
    );
  }
}

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

  async getStoreById(storeId: string): Promise<LocalStore | null> {
    const row = await this.database.getFirstAsync<StoreRow>(
      `select id, owner_user_id, name, currency_code, timezone, updated_at
       from stores
       where id = ?
       limit 1`,
      [storeId],
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

export class TransactionRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async listRecentTransactionsForStore(storeId: string, limit = 20): Promise<LocalTransactionSummary[]> {
    const rows = await this.database.getAllAsync<TransactionSummaryRow>(
      `select
         t.id,
         t.store_id,
         t.raw_text,
         t.source,
         t.sync_status,
         t.parser_source,
         t.local_parse_json,
         t.is_utang,
         t.created_at,
         (
           select ii.name
           from transaction_items ti
           left join inventory_items ii
             on ii.id = ti.item_id and ii.store_id = ti.store_id
           where ti.transaction_id = t.id and ti.store_id = t.store_id
           order by ti.created_at asc
           limit 1
         ) as primary_item_name,
         (
           select ti.quantity_delta
           from transaction_items ti
           where ti.transaction_id = t.id and ti.store_id = t.store_id
           order by ti.created_at asc
           limit 1
         ) as primary_quantity_delta
       from transactions t
       where t.store_id = ?
       order by t.created_at desc
       limit ?`,
      [storeId, limit],
    );

    return rows.map((row) => {
      const localParse = parseLocalParse(row.local_parse_json);

      return {
        id: row.id,
        storeId: row.store_id,
        rawText: row.raw_text,
        source: row.source,
        syncStatus: row.sync_status,
        parserSource: row.parser_source,
        intent: localParse?.intent ?? null,
        primaryItemName: row.primary_item_name,
        primaryQuantityDelta:
          typeof row.primary_quantity_delta === 'number' ? row.primary_quantity_delta : null,
        isUtang: row.is_utang === 1,
        createdAt: row.created_at,
      };
    });
  }

  async listPendingTransactionsForStore(storeId: string, limit = 25): Promise<PendingTransactionForSync[]> {
    const rows = await this.database.getAllAsync<PendingTransactionRow>(
      `select
         t.id,
         t.client_mutation_id,
         t.raw_text,
         t.source,
         t.parser_source,
         t.local_parse_json,
         t.is_utang,
         t.created_at,
         c.name as customer_name
       from transactions t
       left join customers c on c.id = t.customer_id and c.store_id = t.store_id
       where t.store_id = ?
         and t.sync_status = 'pending'
       order by t.created_at asc
       limit ?`,
      [storeId, limit],
    );

    const pending: PendingTransactionForSync[] = [];

    for (const row of rows) {
      const itemRows = await this.database.getAllAsync<PendingTransactionItemRow>(
        `select
           ti.item_id,
           ti.quantity_delta,
           ti.unit_price,
           ti.spoken_name,
           ii.name as item_name,
           ii.unit
         from transaction_items ti
         left join inventory_items ii
           on ii.id = ti.item_id and ii.store_id = ti.store_id
         where ti.transaction_id = ?
           and ti.store_id = ?
         order by ti.created_at asc`,
        [row.id, storeId],
      );

      pending.push({
        id: row.id,
        clientMutationId: row.client_mutation_id,
        rawText: row.raw_text,
        source: row.source,
        parserSource: row.parser_source,
        localParse: parseLocalParse(row.local_parse_json) as Record<string, unknown> | null,
        isUtang: row.is_utang === 1,
        customerName: row.customer_name ?? undefined,
        occurredAt: row.created_at,
        items: itemRows.map((item) => ({
          itemId: item.item_id ?? undefined,
          itemName: item.item_name ?? item.spoken_name ?? 'Unknown Item',
          matchedAlias: item.spoken_name ?? undefined,
          quantityDelta: item.quantity_delta,
          unitPrice: item.unit_price,
          unit: item.unit ?? undefined,
        })),
      });
    }

    return pending;
  }

  async countPendingTransactionsForStore(storeId: string): Promise<number> {
    const row = await this.database.getFirstAsync<{ total: number }>(
      `select count(*) as total
       from transactions
       where store_id = ?
         and sync_status = 'pending'`,
      [storeId],
    );

    return row?.total ?? 0;
  }

  async updateSyncStatusByClientMutationIds(
    storeId: string,
    mutationIds: string[],
    status: string,
  ): Promise<void> {
    if (mutationIds.length === 0) {
      return;
    }

    const placeholders = mutationIds.map(() => '?').join(', ');
    const now = new Date().toISOString();
    await this.database.runAsync(
      `update transactions
       set sync_status = ?,
           synced_at = case when ? in ('synced', 'verified') then ? else synced_at end
       where store_id = ?
         and client_mutation_id in (${placeholders})`,
      [status, status, now, storeId, ...mutationIds],
    );
  }

  async discardPendingTransactionsForStore(storeId: string): Promise<void> {
    await this.database.runAsync(
      `update transactions
       set sync_status = 'discarded'
       where store_id = ?
         and sync_status = 'pending'`,
      [storeId],
    );
  }
}

function parseLocalParse(serialized: string | null): { intent?: string } | null {
  if (!serialized) {
    return null;
  }

  try {
    return JSON.parse(serialized) as { intent?: string };
  } catch {
    return null;
  }
}
