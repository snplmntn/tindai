import { describe, expect, it } from 'vitest';

import type { LocalCustomer, LocalInventoryItem } from '@/features/local-db/types';

import { buildAnalyticsViewModel, type AnalyticsSalesRow } from './buildAnalyticsViewModel';

const inventoryItems: LocalInventoryItem[] = [
  {
    id: 'item-coke',
    storeId: 'store-1',
    name: 'Coke Mismo',
    aliases: ['coke'],
    unit: 'pcs',
    cost: null,
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
    cost: null,
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
    cost: null,
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

const customers: LocalCustomer[] = [
  {
    id: 'customer-juan',
    storeId: 'store-1',
    name: 'Mang Juan',
    utangBalance: 80,
  },
  {
    id: 'customer-maria',
    storeId: 'store-1',
    name: 'Aling Maria',
    utangBalance: 35,
  },
];

describe('buildAnalyticsViewModel', () => {
  it('builds overview, insights, and prediction content from local sales rows', () => {
    const result = buildAnalyticsViewModel({
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      inventoryItems,
      customers,
      salesRows,
      now: '2026-04-25T10:00:00.000Z',
    });

    expect(result.overview.salesToday.value).toBe('P60');
    expect(result.overview.salesToday.caption).toBe('Tantyang halaga ng benta');
    expect(result.overview.itemsSoldToday).toMatchObject({
      label: 'Nabenta Ngayon',
      value: '3 piraso',
    });
    expect(result.overview.salesThisMonth.value).toBe('P125');
    expect(result.overview.topSelling[0]).toMatchObject({
      itemName: 'Coke Mismo',
      detail: '5 pcs na nabenta sa 30 araw',
    });
    expect(result.overview.lowStock[0]).toMatchObject({
      itemName: 'Coke Mismo',
    });
    expect(result.overview.utangSummary).toMatchObject({
      totalBalance: 'P115',
    });
    expect(result.overview.utangSummary.topCustomers[0]).toMatchObject({
      customerName: 'Mang Juan',
      balance: 'P80',
    });
    expect(result.insights.risingDemand[0]).toMatchObject({
      itemName: 'Coke Mismo',
    });
    expect(result.predictions.restockSoon[0]).toMatchObject({
      itemName: 'Coke Mismo',
    });
    expect(result.predictions.shoppingPresets.map((preset) => preset.label)).toEqual([
      '7 araw',
      '14 araw',
      '1 buwan',
    ]);
    expect(result.predictions.shoppingListByPreset['7d'][0]).toMatchObject({
      itemName: 'Coke Mismo',
      recommendedBuyQuantity: 1,
      horizonDays: 7,
    });
    expect(result.predictions.shoppingListByPreset['14d'][0]).toMatchObject({
      itemName: 'Coke Mismo',
      recommendedBuyQuantity: 6,
      horizonDays: 14,
    });
    expect(result.predictions.shoppingListByPreset['30d'][1]).toMatchObject({
      itemName: 'Bigas',
      recommendedBuyQuantity: 10,
      horizonDays: 30,
    });
    expect(result.predictions.recommendations[0]?.body).toContain('Bumili ulit sa loob ng');
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
          cost: null,
          price: 0,
          currentStock: 8,
          lowStockThreshold: 2,
          updatedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      customers: [],
      salesRows: [],
      now: '2026-04-25T10:00:00.000Z',
    });

    expect(result.overview.salesToday.value).toBe('0 piraso');
    expect(result.overview.salesToday.caption).toBe('Wala pang presyong benta');
    expect(result.overview.itemsSoldToday.value).toBe('0 piraso');
    expect(result.overview.utangSummary.totalBalance).toBe('P0');
    expect(result.overview.utangSummary.topCustomers).toEqual([]);
    expect(result.insights.emptyState).toContain('Magdagdag ng mga 7 araw na benta');
    expect(result.predictions.emptyState).toContain('Lalabas ito pag may ilang araw nang benta');
    expect(result.predictions.shoppingListByPreset['7d']).toEqual([]);
    expect(result.predictions.shoppingListByPreset['14d']).toEqual([]);
    expect(result.predictions.shoppingListByPreset['30d']).toEqual([]);
  });
});
