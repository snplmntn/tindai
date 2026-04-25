import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAdminClient } from '../config/supabase';
import { getEnv } from '../config/env';
import { getAnalyticsSummaryForOwner } from '../models/analytics.model';
import { getStoreByOwnerId } from '../models/store.model';
import { generateGeminiText } from '../services/gemini.service';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../config/env', () => ({
  getEnv: vi.fn(),
}));

vi.mock('../models/store.model', () => ({
  getStoreByOwnerId: vi.fn(),
}));

vi.mock('../services/gemini.service', () => ({
  generateGeminiText: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetEnv = vi.mocked(getEnv);
const mockedGetStoreByOwnerId = vi.mocked(getStoreByOwnerId);
const mockedGenerateGeminiText = vi.mocked(generateGeminiText);

function createSupabaseMock() {
  const from = vi.fn((table: string) => {
    if (table === 'v_inventory_dashboard') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'item-coke',
                    name: 'Coke Mismo',
                    unit: 'pcs',
                    current_stock: 4,
                    low_stock_threshold: 5,
                  },
                  {
                    id: 'item-rice',
                    name: 'Bigas',
                    unit: 'kg',
                    current_stock: 8,
                    low_stock_threshold: 2,
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      };
    }

    if (table === 'v_daily_sales_summary') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                returns: vi.fn().mockResolvedValue({
                  data: [
                    {
                      sale_date: '2026-04-25',
                      gross_sales: 60,
                      units_sold: 3,
                      transaction_count: 1,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };
    }

    if (table === 'inventory_movements') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              gte: vi.fn(() => ({
                returns: vi.fn().mockResolvedValue({
                  data: [
                    {
                      item_id: 'item-coke',
                      quantity_delta: -3,
                      movement_type: 'sale',
                      occurred_at: '2026-04-24T18:30:00.000Z',
                    },
                    {
                      item_id: 'item-coke',
                      quantity_delta: -2,
                      movement_type: 'sale',
                      occurred_at: '2026-04-18T18:30:00.000Z',
                    },
                    {
                      item_id: 'item-rice',
                      quantity_delta: -4,
                      movement_type: 'sale',
                      occurred_at: '2026-04-23T18:30:00.000Z',
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unhandled table mock: ${table}`);
  });

  return { from };
}

describe('analytics.model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetStoreByOwnerId.mockResolvedValue({
      id: 'store-1',
      ownerId: 'user-1',
      name: 'Nena Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    mockedGetEnv.mockReturnValue({
      PORT: 4000,
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'anon',
      SUPABASE_SECRET_KEY: 'service-role',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-test',
    });
  });

  it('builds preset shopping lists and enriches the summary prompt with grocery-trip data', async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseAdminClient.mockReturnValue({ from: supabase.from } as never);
    mockedGenerateGeminiText.mockResolvedValue('Restock Coke Mismo before the weekend.');

    const result = await getAnalyticsSummaryForOwner('user-1');

    expect(result.predictions.shoppingPresets.map((preset) => preset.label)).toEqual([
      '7 days',
      '14 days',
      '1 month',
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
    expect(result.predictions.aiSummary).toBe('Restock Coke Mismo before the weekend.');
    expect(mockedGenerateGeminiText).toHaveBeenCalledWith(expect.stringContaining('7-day grocery trip'));
  });
});
