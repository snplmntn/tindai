import { getSupabaseAdminClient } from '../config/supabase';
import { getStoreByOwnerId } from './store.model';

export class InventoryModelError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type InventorySort = 'name' | 'stock_desc' | 'stock_asc';

export type InventoryListOptions = {
  search?: string;
  sort?: InventorySort;
  lowStockOnly?: boolean;
};

export type InventoryMutationInput = {
  name?: string;
  aliases?: string[];
  unit?: string;
  cost?: number | null;
  price?: number;
  lowStockThreshold?: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  aliases: string[];
  unit: string;
  cost: number | null;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
  updatedAt: string;
  isLowStock: boolean;
};

type InventoryRow = {
  id: string;
  store_id: string;
  name: string;
  aliases: string[] | null;
  unit: string;
  cost: number | string | null;
  price: number | string;
  current_stock: number | string;
  low_stock_threshold: number | string;
  is_active: boolean;
  archived_at: string | null;
  updated_at: string;
};

const inventorySelectFields =
  'id, store_id, name, aliases, unit, cost, price, current_stock, low_stock_threshold, is_active, archived_at, updated_at';

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAliases(name: string, aliases?: string[]) {
  const values = [name, ...(aliases ?? [])];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function mapInventoryRow(row: InventoryRow): InventoryItem {
  const currentStock = toNumber(row.current_stock);
  const lowStockThreshold = toNumber(row.low_stock_threshold);

  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    unit: row.unit,
    cost: row.cost === null ? null : toNumber(row.cost),
    price: toNumber(row.price),
    currentStock,
    lowStockThreshold,
    updatedAt: row.updated_at,
    isLowStock: currentStock <= lowStockThreshold,
  };
}

function matchesSearch(item: InventoryItem, query?: string) {
  if (!query) {
    return true;
  }

  const haystack = [item.name, ...item.aliases].map((value) => value.toLowerCase());
  return haystack.some((value) => value.includes(query));
}

function compareInventoryItems(left: InventoryItem, right: InventoryItem, sort: InventorySort) {
  if (sort === 'stock_desc' && right.currentStock !== left.currentStock) {
    return right.currentStock - left.currentStock;
  }

  if (sort === 'stock_asc' && left.currentStock !== right.currentStock) {
    return left.currentStock - right.currentStock;
  }

  return left.name.localeCompare(right.name);
}

async function getRequiredStore(ownerId: string) {
  const store = await getStoreByOwnerId(ownerId);
  if (!store) {
    throw new InventoryModelError(404, 'Store not found.');
  }

  return store;
}

async function listStoreInventoryRows(storeId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('inventory_items')
    .select(inventorySelectFields)
    .eq('store_id', storeId);

  if (error) {
    throw new InventoryModelError(500, 'Unable to load inventory.');
  }

  return (data ?? []).filter((row) => row.is_active && row.archived_at === null);
}

async function getActiveInventoryRow(storeId: string, itemId: string) {
  const rows = await listStoreInventoryRows(storeId);
  return rows.find((row) => row.id === itemId) ?? null;
}

export async function listInventoryItemsForOwner(ownerId: string, options: InventoryListOptions = {}) {
  const store = await getRequiredStore(ownerId);
  const search = options.search?.trim().toLowerCase();
  const sort = options.sort ?? 'name';
  const lowStockOnly = options.lowStockOnly ?? false;
  const items = (await listStoreInventoryRows(store.id)).map(mapInventoryRow);

  return items
    .filter((item) => matchesSearch(item, search))
    .filter((item) => (lowStockOnly ? item.isLowStock : true))
    .sort((left, right) => compareInventoryItems(left, right, sort));
}

export async function getInventoryItemForOwner(ownerId: string, itemId: string) {
  const store = await getRequiredStore(ownerId);
  const row = await getActiveInventoryRow(store.id, itemId);

  if (!row) {
    throw new InventoryModelError(404, 'Inventory item not found.');
  }

  return mapInventoryRow(row);
}

export async function createInventoryItemForOwner(ownerId: string, input: InventoryMutationInput) {
  const store = await getRequiredStore(ownerId);
  const supabase = getSupabaseAdminClient();
  const name = input.name?.trim() ?? '';
  const aliases = normalizeAliases(name, input.aliases);
  const unit = input.unit?.trim() || 'pcs';
  const existingRows = await listStoreInventoryRows(store.id);

  if (existingRows.some((row) => normalizeName(row.name) === normalizeName(name))) {
    throw new InventoryModelError(409, 'An active item with that name already exists.');
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      store_id: store.id,
      name,
      aliases,
      unit,
      cost: input.cost ?? null,
      price: input.price ?? 0,
      low_stock_threshold: input.lowStockThreshold ?? 0,
    })
    .select(inventorySelectFields)
    .single<InventoryRow>();

  if (error || !data) {
    throw new InventoryModelError(500, 'Unable to create inventory item.');
  }

  return mapInventoryRow(data);
}

export async function updateInventoryItemForOwner(ownerId: string, itemId: string, input: InventoryMutationInput) {
  const store = await getRequiredStore(ownerId);
  const supabase = getSupabaseAdminClient();
  const existingRow = await getActiveInventoryRow(store.id, itemId);

  if (!existingRow) {
    throw new InventoryModelError(404, 'Inventory item not found.');
  }

  const nextName = input.name?.trim() || existingRow.name;
  const existingRows = await listStoreInventoryRows(store.id);
  if (
    normalizeName(nextName) !== normalizeName(existingRow.name) &&
    existingRows.some((row) => row.id !== itemId && normalizeName(row.name) === normalizeName(nextName))
  ) {
    throw new InventoryModelError(409, 'An active item with that name already exists.');
  }

  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    payload.name = nextName;
  }

  if (input.aliases !== undefined || input.name !== undefined) {
    payload.aliases = normalizeAliases(nextName, input.aliases ?? existingRow.aliases ?? []);
  }

  if (input.unit !== undefined) {
    payload.unit = input.unit.trim();
  }

  if (input.cost !== undefined) {
    payload.cost = input.cost;
  }

  if (input.price !== undefined) {
    payload.price = input.price;
  }

  if (input.lowStockThreshold !== undefined) {
    payload.low_stock_threshold = input.lowStockThreshold;
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .update(payload)
    .eq('store_id', store.id)
    .eq('id', itemId)
    .is('archived_at', null)
    .select(inventorySelectFields)
    .maybeSingle<InventoryRow>();

  if (error) {
    throw new InventoryModelError(500, 'Unable to update inventory item.');
  }

  if (!data) {
    throw new InventoryModelError(404, 'Inventory item not found.');
  }

  return mapInventoryRow(data);
}

export async function archiveInventoryItemForOwner(ownerId: string, itemId: string) {
  const store = await getRequiredStore(ownerId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq('store_id', store.id)
    .eq('id', itemId)
    .is('archived_at', null)
    .select(inventorySelectFields)
    .maybeSingle<InventoryRow>();

  if (error) {
    throw new InventoryModelError(500, 'Unable to archive inventory item.');
  }

  if (!data) {
    throw new InventoryModelError(404, 'Inventory item not found.');
  }

  return mapInventoryRow(data);
}
