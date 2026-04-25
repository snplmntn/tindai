import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  getClientEnv: () => ({
    EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:4000',
  }),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { RemoteDataSource } from './remoteDataSource';

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

describe('RemoteDataSource', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads inventory items from the backend inventory endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'item-1',
              name: 'Coke Mismo',
              aliases: ['coke', 'softdrink'],
              unit: 'pcs',
              cost: 14,
              price: 20,
              currentStock: 8,
              lowStockThreshold: 4,
              updatedAt: '2026-04-25T00:00:00.000Z',
              isLowStock: false,
            },
          ],
        }),
      }),
    );

    const remoteDataSource = new RemoteDataSource('access-token-123');
    const items = await remoteDataSource.getInventoryItems('store-123');

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:4000/api/v1/inventory/items', {
      headers: {
        Authorization: 'Bearer access-token-123',
      },
    });
    expect(items).toEqual([
      {
        id: 'item-1',
        storeId: 'store-123',
        name: 'Coke Mismo',
        aliases: ['coke', 'softdrink'],
        unit: 'pcs',
        cost: 14,
        price: 20,
        currentStock: 8,
        lowStockThreshold: 4,
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    ]);
  });

  it('surfaces backend inventory errors', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 500,
        json: async () => ({
          message: 'Online inventory is unavailable right now.',
        }),
      }),
    );

    const remoteDataSource = new RemoteDataSource('access-token-123');

    await expect(remoteDataSource.getInventoryItems('store-123')).rejects.toThrow(
      'Online inventory is unavailable right now.',
    );
  });
});
