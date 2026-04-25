import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { AnalyticsView } from '@/features/analytics/AnalyticsView';
import { fetchAnalyticsSummary, type RemoteAnalyticsSummary } from '@/features/analytics/analyticsApi';
import { loadAnalyticsSalesRows } from '@/features/analytics/analyticsRepository';
import {
  buildAnalyticsViewModel,
  type AnalyticsSalesRow,
  type AnalyticsViewModel,
} from '@/features/analytics/buildAnalyticsViewModel';
import { useLocalData } from '@/features/local-data/LocalDataContext';

type AnalyticsTabKey = 'Overview' | 'Insights' | 'Predictions & AI';

export function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const { store, inventoryItems, customers, pendingTransactions } = useLocalData();
  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('Overview');
  const [salesRows, setSalesRows] = useState<AnalyticsSalesRow[]>([]);
  const [remoteSummary, setRemoteSummary] = useState<RemoteAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const hasPendingTransactions = pendingTransactions.length > 0;
  const showSkeleton = isLoading && salesRows.length === 0 && !remoteSummary;
  const showEmptyState = Boolean(store) && inventoryItems.length === 0 && salesRows.length === 0 && !remoteSummary;

  const loadAnalytics = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!store) {
        setSalesRows([]);
        setRemoteSummary(null);
        setLocalError(null);
        setRemoteError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLocalError(null);
      setRemoteError(null);

      try {
        const [localResult, remoteResult] = await Promise.all([
          (async () => {
            try {
              const rows = await loadAnalyticsSalesRows(store.id);
              return { rows, error: null as string | null };
            } catch (caughtError) {
              return {
                rows: [] as AnalyticsSalesRow[],
                error: caughtError instanceof Error ? caughtError.message : 'Unable to load local analytics.',
              };
            }
          })(),
          (async () => {
            if (!isAuthenticated) {
              return {
                summary: null as RemoteAnalyticsSummary | null,
                error: null as string | null,
              };
            }

            try {
              const { data } = await supabase.auth.getSession();
              const accessToken = data.session?.access_token;
              if (!accessToken) {
                return {
                  summary: null as RemoteAnalyticsSummary | null,
                  error: null as string | null,
                };
              }

              const summary = await fetchAnalyticsSummary(accessToken);
              return {
                summary,
                error: null as string | null,
              };
            } catch {
              return {
                summary: null as RemoteAnalyticsSummary | null,
                error: "Online analytics is unavailable. Showing this phone's recent records.",
              };
            }
          })(),
        ]);

        setSalesRows(localResult.rows);
        setLocalError(localResult.error);
        setRemoteSummary(remoteResult.summary);
        setRemoteError(remoteResult.error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, store],
  );

  useEffect(() => {
    void loadAnalytics('initial');
  }, [inventoryItems, loadAnalytics]);

  const localViewModel = useMemo(
    () => {
      return buildAnalyticsViewModel({
        currencyCode: store?.currencyCode ?? 'PHP',
        timezone: store?.timezone ?? 'Asia/Manila',
        inventoryItems,
        customers,
        salesRows,
      });
    },
    [customers, inventoryItems, salesRows, store?.currencyCode, store?.timezone],
  );

  const viewModel = useMemo<AnalyticsViewModel>(() => {
    if (!remoteSummary) {
      return localViewModel;
    }

    if (hasPendingTransactions) {
      return localViewModel;
    }

    return {
      overview: remoteSummary.overview,
      insights: remoteSummary.insights,
      predictions: remoteSummary.predictions,
    };
  }, [hasPendingTransactions, localViewModel, remoteSummary]);

  const error = localError ?? remoteError;
  const handleAddFirstItem = useCallback(() => {
    navigation.navigate(
      'Inventory' as never,
      {
        openAddItemRequestId: 'analytics-empty-state',
      } as never,
    );
  }, [navigation]);

  return (
    <AnalyticsView
      activeTab={activeTab}
      emptyState={
        showEmptyState
          ? {
              title: 'Wala pang mababasang galaw',
              body: 'Magdagdag muna ng unang item para magsimulang lumabas dito ang benta, natitirang stock, at mga payo.',
              actionLabel: 'Magdagdag ng unang item',
              onAction: handleAddFirstItem,
            }
          : null
      }
      error={error}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      onTabChange={setActiveTab}
      onRefresh={() => void loadAnalytics('refresh')}
      showSkeleton={showSkeleton}
      storeName={store?.name ?? 'your store'}
      viewModel={viewModel}
    />
  );
}
