import type { LocalInventoryItem } from '@/features/local-db/types';

import type { AnalyticsSalesRow } from './buildAnalyticsViewModel';

export const ANALYTICS_PREVIEW_NOW = '2026-04-25T10:00:00.000Z';

export const ANALYTICS_PREVIEW_INVENTORY_ITEMS: LocalInventoryItem[] = [
  {
    id: 'item-coke',
    storeId: 'preview-store',
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
    storeId: 'preview-store',
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
    storeId: 'preview-store',
    name: 'Bigas',
    aliases: ['rice'],
    unit: 'kg',
    price: 0,
    currentStock: 8,
    lowStockThreshold: 2,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

export const ANALYTICS_PREVIEW_SALES_ROWS: AnalyticsSalesRow[] = [
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
