import { describe, expect, it } from 'vitest';

import type { LocalInventoryItem } from '@/features/local-db/types';

import { buildAnalyticsViewModel, type AnalyticsSalesRow } from './buildAnalyticsViewModel';

const inventoryItems: LocalInventoryItem[] = [
  {
    id: 'item-coke',
    storeId: 'store-1',
    name: 'Coke Mismo',
    aliases: ['coke'],
    unit: 'pcs',
    price: 20,
    currentStock: 4,
    lowStockThreshold: 5,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
  {
    id: 'item-soap',
    storeId: 'store-1',
    name: 'Safeguard',
    aliases: ['soap'],
    unit: 'pcs',
    price: 25,
    currentStock: 10,
    lowStockThreshold: 3,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
  {
    id: 'item-rice',
    storeId: 'store-1',
    name: 'Bigas',
    aliases: ['rice'],
    unit: 'kg',
    price: 0,
    currentStock: 8,
    lowStockThreshold: 2,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

const salesRows: AnalyticsSalesRow[] = [
  {
    itemId: 'item-coke',
    itemName: 'Coke Mismo',
    unit: 'pcs',
    quantityDelta: -3,
    unitPrice: 20,
    lineTotal: 60,
    occurredAt: '2026-04-24T18:30:00.000Z',
    isUtang: false,
  },
  {
    itemId: 'item-coke',
    itemName: 'Coke Mismo',
    unit: 'pcs',
    quantityDelta: -2,
    unitPrice: 20,
    lineTotal: 40,
    occurredAt: '2026-04-18T18:30:00.000Z',
    isUtang: false,
  },
  {
    itemId: 'item-soap',
    itemName: 'Safeguard',
    unit: 'pcs',
    quantityDelta: -1,
    unitPrice: 25,
    lineTotal: 25,
    occurredAt: '2026-04-11T18:30:00.000Z',
    isUtang: false,
  },
  {
    itemId: 'item-rice',
    itemName: 'Bigas',
    unit: 'kg',
    quantityDelta: -4,
    unitPrice: 0,
    lineTotal: 0,
    occurredAt: '2026-04-23T18:30:00.000Z',
    isUtang: false,
  },
];

describe('buildAnalyticsViewModel', () => {
  it('builds overview, insights, and prediction content from local sales rows', () => {
    const result = buildAnalyticsViewModel({
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      inventoryItems,
      salesRows,
      now: '2026-04-25T10:00:00.000Z',
    });

    expect(result.overview.salesToday.value).toBe('P60');
    expect(result.overview.salesToday.caption).toBe('Estimated revenue');
    expect(result.overview.salesThisMonth.value).toBe('P125');
    expect(result.overview.topSelling[0]).toMatchObject({
      itemName: 'Coke Mismo',
      detail: '5 pcs sold in 30 days',
    });
    expect(result.overview.lowStock[0]).toMatchObject({
      itemName: 'Coke Mismo',
    });
    expect(result.insights.risingDemand[0]).toMatchObject({
      itemName: 'Coke Mismo',
    });
    expect(result.predictions.restockSoon[0]).toMatchObject({
      itemName: 'Coke Mismo',
    });
    expect(result.predictions.recommendations[0]?.body).toContain('Restock within');
  });

  it('falls back to units and honest empty states when history or price coverage is weak', () => {
    const result = buildAnalyticsViewModel({
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      inventoryItems: [
        {
          id: 'item-rice',
          storeId: 'store-1',
          name: 'Bigas',
          aliases: ['rice'],
          unit: 'kg',
          price: 0,
          currentStock: 8,
          lowStockThreshold: 2,
          updatedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      salesRows: [],
      now: '2026-04-25T10:00:00.000Z',
    });

    expect(result.overview.salesToday.value).toBe('0 units');
    expect(result.overview.salesToday.caption).toBe('No priced sales yet');
    expect(result.insights.emptyState).toContain('Need at least 7 days');
    expect(result.predictions.emptyState).toContain('Forecasts will appear');
  });
});
