import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAdminClient } from '../config/supabase';
import {
  archiveInventoryItemForOwner,
  createInventoryItemForOwner,
  InventoryModelError,
  listInventoryItemsForOwner,
  updateInventoryItemForOwner,
} from '../models/inventory.model';
import { getStoreByOwnerId } from '../models/store.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/store.model', () => ({
  getStoreByOwnerId: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetStoreByOwnerId = vi.mocked(getStoreByOwnerId);

function createSupabaseMock() {
  let lastUpdatePayload: Record<string, unknown> | null = null;
  const activeInventoryRows = [
    {
      id: 'item-coke',
      store_id: 'store-1',
      name: 'Coke Mismo',
      aliases: ['coke', 'coke mismo'],
      unit: 'pcs',
      cost: 14,
      price: 20,
      current_stock: 4,
      low_stock_threshold: 5,
      is_active: true,
      archived_at: null,
      updated_at: '2026-04-25T00:00:00.000Z',
    },
    {
      id: 'item-soap',
      store_id: 'store-1',
      name: 'Safeguard',
      aliases: ['soap'],
      unit: 'pcs',
      cost: 18,
      price: 25,
      current_stock: 12,
      low_stock_threshold: 3,
      is_active: true,
      archived_at: null,
      updated_at: '2026-04-25T00:00:00.000Z',
    },
    {
      id: 'item-noodles',
      store_id: 'store-1',
      name: 'Lucky Me Pancit Canton',
      aliases: ['canton', 'noodles'],
      unit: 'pcs',
      cost: 11,
      price: 18,
      current_stock: 7,
      low_stock_threshold: 5,
      is_active: true,
      archived_at: null,
      updated_at: '2026-04-25T00:00:00.000Z',
    },
  ];

  const inventorySelectMaybeSingle = vi.fn().mockResolvedValue({
    data: activeInventoryRows[0],
    error: null,
  });

  const inventoryInsertSingle = vi.fn().mockResolvedValue({
    data: activeInventoryRows[0],
    error: null,
  });

  const inventoryUpdateMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      ...activeInventoryRows[0],
      price: 22,
    },
    error: null,
  });

  const from = vi.fn((table: string) => {
    if (table !== 'inventory_items') {
      throw new Error(`Unhandled table mock: ${table}`);
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: activeInventoryRows,
          error: null,
        }),
      })),
      insert: vi.fn((payload: Record<string, unknown>) => ({
        select: vi.fn(() => ({
          single: inventoryInsertSingle.mockImplementation(async () => ({
            data: {
              ...activeInventoryRows[0],
              id: 'item-new',
              name: String(payload.name),
              aliases: (payload.aliases as string[]) ?? [],
              unit: String(payload.unit),
              cost: payload.cost as number | null,
              price: payload.price as number,
              current_stock: 0,
              low_stock_threshold: payload.low_stock_threshold as number,
            },
            error: null,
          })),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        lastUpdatePayload = payload;

        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: inventoryUpdateMaybeSingle.mockImplementation(async () => ({
                    data: {
                      ...activeInventoryRows[0],
                      ...('price' in payload ? { price: payload.price } : {}),
                      ...('aliases' in payload ? { aliases: payload.aliases } : {}),
                      ...('archived_at' in payload ? { archived_at: payload.archived_at } : {}),
                      updated_at: '2026-04-26T00:00:00.000Z',
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }),
    };
  });

  return {
    activeInventoryRows,
    from,
    getLastUpdatePayload: () => lastUpdatePayload,
  };
}

describe('inventory.model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetStoreByOwnerId.mockResolvedValue({
      id: 'store-1',
      ownerId: 'user-1',
      name: 'Tindai Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
  });

  it('filters, sorts, and derives low-stock state from active store items', async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseAdminClient.mockReturnValue({ from: supabase.from } as never);

    const result = await listInventoryItemsForOwner('user-1', {
      search: 'co',
      sort: 'stock_asc',
      lowStockOnly: true,
    });

    expect(result).toEqual([
      {
        id: 'item-coke',
        name: 'Coke Mismo',
        aliases: ['coke', 'coke mismo'],
        unit: 'pcs',
        cost: 14,
        price: 20,
        currentStock: 4,
        lowStockThreshold: 5,
        updatedAt: '2026-04-25T00:00:00.000Z',
        isLowStock: true,
      },
    ]);
  });

  it('creates inventory metadata with normalized aliases and default unit', async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseAdminClient.mockReturnValue({ from: supabase.from } as never);

    const result = await createInventoryItemForOwner('user-1', {
      name: '  Bear Brand  ',
      aliases: ['gatas', 'GATAS', ''],
      price: 20,
    });

    expect(result).toEqual({
      id: 'item-new',
      name: 'Bear Brand',
      aliases: ['Bear Brand', 'gatas'],
      unit: 'pcs',
      cost: null,
      price: 20,
      currentStock: 0,
      lowStockThreshold: 0,
      updatedAt: '2026-04-25T00:00:00.000Z',
      isLowStock: true,
    });
  });

  it('throws conflict for duplicate active item names', async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseAdminClient.mockReturnValue({ from: supabase.from } as never);

    await expect(
      createInventoryItemForOwner('user-1', {
        name: 'Coke Mismo',
        price: 20,
      }),
    ).rejects.toMatchObject({
      message: 'An active item with that name already exists.',
      status: 409,
    });
  });

  it('updates metadata fields without writing current stock', async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseAdminClient.mockReturnValue({ from: supabase.from } as never);

    const result = await updateInventoryItemForOwner('user-1', 'item-coke', {
      aliases: ['coke', 'softdrink'],
      price: 22,
    });

    expect(result.price).toBe(22);
    expect(supabase.getLastUpdatePayload()).toEqual({
      aliases: ['Coke Mismo', 'coke', 'softdrink'],
      price: 22,
    });
  });

  it('archives items with a soft archive update', async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseAdminClient.mockReturnValue({ from: supabase.from } as never);

    const result = await archiveInventoryItemForOwner('user-1', 'item-coke');

    expect(result.id).toBe('item-coke');
  });
});
