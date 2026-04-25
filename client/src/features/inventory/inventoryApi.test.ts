import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  getClientEnv: () => ({
    EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:4000',
  }),
}));

import { archiveInventoryItem, createInventoryItem, updateInventoryItem } from './inventoryApi';

type MockResponseInit = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

function createMockResponse({ ok, status = ok ? 200 : 500, json }: MockResponseInit) {
  return {
    ok,
    status,
    json,
  } as Response;
}

describe('inventoryApi', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('creates inventory metadata through the backend', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        status: 201,
        json: async () => ({
          item: {
            id: 'item-1',
            name: 'Bear Brand',
            aliases: ['Bear Brand'],
            unit: 'pcs',
            cost: 14.5,
            price: 18,
            currentStock: 0,
            lowStockThreshold: 5,
            updatedAt: '2026-04-26T00:00:00.000Z',
            isLowStock: true,
          },
        }),
      }),
    );

    const item = await createInventoryItem('token-123', {
      name: 'Bear Brand',
      aliases: ['Bear Brand'],
      unit: 'pcs',
      cost: 14.5,
      price: 18,
      lowStockThreshold: 5,
    });

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:4000/api/v1/inventory/items', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Bear Brand',
        aliases: ['Bear Brand'],
        unit: 'pcs',
        cost: 14.5,
        price: 18,
        lowStockThreshold: 5,
      }),
    });
    expect(item.name).toBe('Bear Brand');
  });

  it('updates inventory metadata through the backend', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: async () => ({
          item: {
            id: 'item-1',
            name: 'Softdrink Mismo',
            aliases: ['coke'],
            unit: 'pcs',
            cost: 12,
            price: 22,
            currentStock: 4,
            lowStockThreshold: 3,
            updatedAt: '2026-04-26T00:00:00.000Z',
            isLowStock: false,
          },
        }),
      }),
    );

    const item = await updateInventoryItem('token-123', 'item-1', {
      price: 22,
      lowStockThreshold: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:4000/api/v1/inventory/items/item-1', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price: 22,
        lowStockThreshold: 3,
      }),
    });
    expect(item.price).toBe(22);
  });

  it('archives an inventory item through the backend', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: async () => ({
          item: {
            id: 'item-1',
            name: 'Softdrink Mismo',
            aliases: ['coke'],
            unit: 'pcs',
            cost: 12,
            price: 20,
            currentStock: 4,
            lowStockThreshold: 3,
            updatedAt: '2026-04-26T00:00:00.000Z',
            isLowStock: false,
          },
        }),
      }),
    );

    const item = await archiveInventoryItem('token-123', 'item-1');

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:4000/api/v1/inventory/items/item-1/archive', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
      },
    });
    expect(item.id).toBe('item-1');
  });

  it('surfaces backend inventory mutation errors', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 409,
        json: async () => ({
          message: 'An active item with that name already exists.',
        }),
      }),
    );

    await expect(
      createInventoryItem('token-123', {
        name: 'Bear Brand',
        price: 18,
      }),
    ).rejects.toThrow('An active item with that name already exists.');
  });
});
