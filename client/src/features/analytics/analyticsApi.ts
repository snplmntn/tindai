import { getClientEnv } from '@/config/env';

import type { AnalyticsViewModel } from './buildAnalyticsViewModel';

export type RemoteAnalyticsSummary = {
  meta: {
    generatedAt: string;
    storeId: string;
    currencyCode: string;
    timezone: string;
    predictionMode: 'deterministic' | 'gemini_enriched';
  };
  overview: AnalyticsViewModel['overview'];
  insights: AnalyticsViewModel['insights'];
  predictions: AnalyticsViewModel['predictions'];
};

type AnalyticsSummaryResponse = {
  analytics?: RemoteAnalyticsSummary;
  message?: string;
};

export async function fetchAnalyticsSummary(accessToken: string): Promise<RemoteAnalyticsSummary> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/analytics/summary`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as AnalyticsSummaryResponse | null;
  if (!response.ok || !payload?.analytics) {
    throw new Error(payload?.message ?? 'Online analytics is unavailable right now.');
  }

  return payload.analytics;
}
