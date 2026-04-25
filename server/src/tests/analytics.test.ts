import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { getAnalyticsSummaryForOwner } from '../models/analytics.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/analytics.model', () => ({
  getAnalyticsSummaryForOwner: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetAnalyticsSummaryForOwner = vi.mocked(getAnalyticsSummaryForOwner);

function mockAuthenticatedUser() {
  mockedGetSupabaseAdminClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'owner@tindai.app',
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  } as never);
}

describe('GET /api/v1/analytics/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns analytics summary for the authenticated owner', async () => {
    mockAuthenticatedUser();
    mockedGetAnalyticsSummaryForOwner.mockResolvedValue({
      meta: {
        generatedAt: '2026-04-25T10:00:00.000Z',
        storeId: 'store-1',
        currencyCode: 'PHP',
        timezone: 'Asia/Manila',
        predictionMode: 'deterministic',
      },
      overview: {
        salesToday: { label: 'Sales Today', value: 'P80', caption: 'Revenue' },
        salesThisMonth: { label: 'Sales This Month', value: 'P320', caption: 'Revenue' },
        topSelling: [],
        lowStock: [],
        fastMoving: [],
        slowMoving: [],
      },
      insights: {
        salesTrend: [],
        demandTrend: [],
        risingDemand: [],
        decliningDemand: [],
        emptyState: null,
      },
      predictions: {
        forecast: [],
        restockSoon: [],
        shoppingPresets: [
          { key: '7d', label: '7 days', days: 7 },
          { key: '14d', label: '14 days', days: 14 },
          { key: '30d', label: '1 month', days: 30 },
        ],
        shoppingListByPreset: {
          '7d': [],
          '14d': [],
          '30d': [],
        },
        recommendations: [],
        emptyState: null,
        modelStatus: 'deterministic_fallback',
        aiSummary: null,
      },
    });

    const response = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedGetAnalyticsSummaryForOwner).toHaveBeenCalledWith('user-123');
    expect(response.body.analytics.meta.storeId).toBe('store-1');
    expect(response.body.analytics.overview.salesToday.value).toBe('P80');
  });

  it('returns 401 when bearer token is missing', async () => {
    const response = await request(app).get('/api/v1/analytics/summary').expect(401);

    expect(mockedGetAnalyticsSummaryForOwner).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      message: 'Missing bearer token.',
    });
  });
});
