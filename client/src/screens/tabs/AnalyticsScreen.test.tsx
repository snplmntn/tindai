import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

import type { RemoteAnalyticsSummary } from '@/features/analytics/analyticsApi';
import type { AnalyticsSalesRow } from '@/features/analytics/buildAnalyticsViewModel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

const mockedStore = {
  id: 'store-1',
  ownerId: 'user-1',
  name: 'Nena Store',
  currencyCode: 'PHP',
  timezone: 'Asia/Manila',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

let mockedInventoryItems = [
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
];

let mockedPendingTransactions: Array<{ id: string; syncStatus: string }> = [];
let mockedIsAuthenticated = false;
const mockedRefresh = vi.fn();
const mockedSubmitLocalCommand = vi.fn();
const mockedLoadAnalyticsSalesRows = vi.fn<(...args: unknown[]) => Promise<AnalyticsSalesRow[]>>(async () => []);
const mockedFetchAnalyticsSummary = vi.fn<(...args: unknown[]) => Promise<RemoteAnalyticsSummary>>();
const mockedGetSession = vi.fn(async () => ({
  data: {
    session: {
      access_token: 'token-1',
    },
  },
}));

vi.mock('react-native', () => ({
  Pressable: ({ children, ...props }: { children: React.ReactNode }) => createElement('mock-pressable', props, children),
  RefreshControl: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('mock-refresh-control', props, children),
  ScrollView: ({ children, ...props }: { children: React.ReactNode }) => createElement('mock-scroll-view', props, children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Text: ({ children }: { children: React.ReactNode }) => createElement('mock-text', null, children),
  View: ({ children, ...props }: { children: React.ReactNode }) => createElement('mock-view', props, children),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => createElement('safe-area-view', null, children),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@/navigation/colors', () => ({
  colors: {
    background: '#FAFBF8',
    border: '#D8E2DA',
    card: '#EDF6EF',
    muted: '#66706B',
    primary: '#1F7A63',
    primaryDeep: '#145746',
    secondary: '#F2C94C',
    surface: '#FFFDF5',
    surfaceAlt: '#F4F8F2',
    text: '#1F2925',
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockedIsAuthenticated,
  }),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockedGetSession(),
    },
  },
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  useLocalData: () => ({
    store: mockedStore,
    inventoryItems: mockedInventoryItems,
    pendingTransactions: mockedPendingTransactions,
    isLoading: false,
    error: null,
    refresh: mockedRefresh,
    submitLocalCommand: mockedSubmitLocalCommand,
  }),
}));

vi.mock('@/features/analytics/analyticsRepository', () => ({
  loadAnalyticsSalesRows: (storeId: string) => mockedLoadAnalyticsSalesRows(storeId),
}));

vi.mock('@/features/analytics/analyticsApi', () => ({
  fetchAnalyticsSummary: (accessToken: string) => mockedFetchAnalyticsSummary(accessToken),
}));

vi.mock('@/features/analytics/AnalyticsCharts', () => ({
  SalesTrendBarChart: () => createElement('mock-view', { 'data-chart': 'sales-trend' }),
  InsightsTrendLineChart: () => createElement('mock-view', { 'data-chart': 'insights-trend' }),
  ForecastSparklineChart: () => createElement('mock-view', { 'data-chart': 'forecast-sparkline' }),
}));

import { AnalyticsScreen } from './AnalyticsScreen';

function findTextNodes(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node) =>
      String(node.type) === 'mock-text' &&
      node.children.some((child) => typeof child === 'string' && child.includes(text)),
  );
}

function findPressable(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root.find(
    (node) =>
      String(node.type) === 'mock-pressable' &&
      node.findAll(
        (child) =>
          String(child.type) === 'mock-text' &&
          child.children.some((grandChild) => typeof grandChild === 'string' && grandChild.includes(text)),
      ).length > 0,
  );
}

function findPressables(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((node) => String(node.type) === 'mock-pressable');
}

function findScrollView(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.find((node) => String(node.type) === 'mock-scroll-view');
}

function buildRemoteSummary(): RemoteAnalyticsSummary {
  return {
    meta: {
      generatedAt: '2026-04-25T00:00:00.000Z',
      storeId: 'store-1',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      predictionMode: 'gemini_enriched',
    },
    overview: {
      salesToday: {
        label: 'Sales Today',
        value: 'P999',
        caption: 'Revenue',
      },
      salesThisMonth: {
        label: 'Sales This Month',
        value: 'P5600',
        caption: 'Revenue',
      },
      topSelling: [
        {
          itemId: 'item-remote-1',
          itemName: 'Remote Sardines',
          detail: '15 cans sold in 30 days',
        },
      ],
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
      recommendations: [
        {
          title: 'AI Summary',
          body: 'Remote AI says Coke may run out within 3 days.',
        },
      ],
      emptyState: null,
      modelStatus: 'gemini_enriched',
      aiSummary: 'Remote AI says Coke may run out within 3 days.',
    },
  };
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

    mockedInventoryItems = [
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
    ];
    mockedPendingTransactions = [];
    mockedIsAuthenticated = false;
    mockedLoadAnalyticsSalesRows.mockReset();
    mockedLoadAnalyticsSalesRows.mockResolvedValue([]);
    mockedFetchAnalyticsSummary.mockReset();
    mockedGetSession.mockReset();
    mockedGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
        },
      },
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('defaults to overview and switches tabs without extra action buttons', async () => {
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(createElement(AnalyticsScreen));
      await Promise.resolve();
    });

    expect(findTextNodes(tree, 'Business Insights')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Overview')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Sales Trend')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Top Selling Items')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Predictions & AI')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Stock Prediction')).toHaveLength(0);
    expect(findPressables(tree)).toHaveLength(3);

    await act(async () => {
      findPressable(tree, 'Insights').props.onPress();
    });

    expect(findTextNodes(tree, 'Analytics Insights')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Fast & Slow Moving Items')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Trend Detection')).not.toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Predictions & AI').props.onPress();
    });

    expect(findTextNodes(tree, 'Stock Prediction')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'AI Performance Summary')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Suggest Restock')).not.toHaveLength(0);
  });

  it('renders preview analytics when local rows are empty and no remote session is used', async () => {
    mockedInventoryItems = [];

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(createElement(AnalyticsScreen));
      await Promise.resolve();
    });

    expect(findTextNodes(tree, 'P60')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Coke Mismo')).not.toHaveLength(0);
    expect(findTextNodes(tree, '0 units')).toHaveLength(0);
    expect(mockedFetchAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('hydrates analytics from backend when authenticated and no pending transactions exist', async () => {
    mockedIsAuthenticated = true;
    mockedFetchAnalyticsSummary.mockResolvedValue(buildRemoteSummary());

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(createElement(AnalyticsScreen));
      await Promise.resolve();
    });

    expect(mockedFetchAnalyticsSummary).toHaveBeenCalledWith('token-1');
    expect(findTextNodes(tree, 'P999')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Remote Sardines')).not.toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Predictions & AI').props.onPress();
    });

    expect(findTextNodes(tree, 'AI-enriched forecast')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Remote AI says Coke may run out within 3 days.')).not.toHaveLength(0);
  });

  it('keeps Overview and Insights local when pending transactions exist but still uses backend Predictions', async () => {
    mockedIsAuthenticated = true;
    mockedPendingTransactions = [{ id: 'txn-pending-1', syncStatus: 'pending' }];
    mockedFetchAnalyticsSummary.mockResolvedValue(buildRemoteSummary());
    mockedLoadAnalyticsSalesRows.mockResolvedValue([
      {
        itemId: 'item-coke',
        itemName: 'Coke Mismo',
        unit: 'pcs',
        quantityDelta: -2,
        unitPrice: 20,
        lineTotal: 40,
        occurredAt: '2026-04-25T08:00:00.000Z',
        isUtang: false,
      },
    ]);

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(createElement(AnalyticsScreen));
      await Promise.resolve();
    });

    expect(findTextNodes(tree, 'P40')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'P999')).toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Predictions & AI').props.onPress();
    });

    expect(findTextNodes(tree, 'Remote AI says Coke may run out within 3 days.')).not.toHaveLength(0);
  });

  it('shows skeleton while analytics are still loading', async () => {
    mockedLoadAnalyticsSalesRows.mockImplementation(
      () => new Promise<AnalyticsSalesRow[]>((resolve) => setTimeout(() => resolve([]), 30)),
    );

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(createElement(AnalyticsScreen));
      await Promise.resolve();
    });

    expect(findTextNodes(tree, 'Loading analytics...')).not.toHaveLength(0);
  });

  it('supports pull-to-refresh to rerun analytics loading', async () => {
    mockedIsAuthenticated = true;
    mockedFetchAnalyticsSummary.mockResolvedValue(buildRemoteSummary());

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(createElement(AnalyticsScreen));
      await Promise.resolve();
    });

    const baselineCalls = mockedLoadAnalyticsSalesRows.mock.calls.length;
    expect(baselineCalls).toBeGreaterThanOrEqual(1);
    const scrollView = findScrollView(tree);
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl).toBeTruthy();

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(mockedLoadAnalyticsSalesRows.mock.calls.length).toBeGreaterThan(baselineCalls);
  });
});
