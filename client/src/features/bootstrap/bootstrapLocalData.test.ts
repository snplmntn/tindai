import { describe, expect, it, vi } from 'vitest';

import { bootstrapLocalData } from './bootstrapLocalData';

describe('bootstrapLocalData', () => {
  it('caches the authenticated store and inventory snapshot locally', async () => {
    const storeRepository = {
      upsertStore: vi.fn().mockResolvedValue(undefined),
    };
    const inventoryRepository = {
      replaceInventoryForStore: vi.fn().mockResolvedValue(undefined),
    };
    const remoteDataSource = {
      getCurrentStore: vi.fn().mockResolvedValue({
        id: 'store-123',
        ownerId: 'user-123',
        name: 'Tindai Demo Store',
        currencyCode: 'PHP',
        timezone: 'Asia/Manila',
        updatedAt: '2026-04-25T00:00:00.000Z',
      }),
      getInventoryItems: vi.fn().mockResolvedValue([
        {
          id: 'item-123',
          storeId: 'store-123',
          name: 'Coke Mismo',
          aliases: ['coke', 'coke mismo'],
          unit: 'pcs',
          price: 20,
          currentStock: 10,
          lowStockThreshold: 5,
          updatedAt: '2026-04-25T00:00:00.000Z',
        },
      ]),
    };

    const result = await bootstrapLocalData({
      storeRepository,
      inventoryRepository,
      remoteDataSource,
    });

    expect(result).toEqual({
      storeId: 'store-123',
      inventoryCount: 1,
    });
    expect(storeRepository.upsertStore).toHaveBeenCalledWith({
      id: 'store-123',
      ownerId: 'user-123',
      name: 'Tindai Demo Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    expect(inventoryRepository.replaceInventoryForStore).toHaveBeenCalledWith('store-123', [
      {
        id: 'item-123',
        storeId: 'store-123',
        name: 'Coke Mismo',
        aliases: ['coke', 'coke mismo'],
        unit: 'pcs',
        price: 20,
        currentStock: 10,
        lowStockThreshold: 5,
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    ]);
  });
});
