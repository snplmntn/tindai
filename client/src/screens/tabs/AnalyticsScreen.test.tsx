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

let mockedCustomers = [
  {
    id: 'customer-1',
    storeId: 'store-1',
    name: 'Mang Juan',
    utangBalance: 80,
  },
];

let mockedPendingTransactions: Array<{ id: string; syncStatus: string }> = [];
let mockedIsAuthenticated = false;
const mockedNavigate = vi.fn();
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

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockedNavigate,
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
    customers: mockedCustomers,
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

async function renderAnalyticsScreen() {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(createElement(AnalyticsScreen));
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return tree;
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
        label: 'Benta Ngayon',
        value: 'P999',
        caption: 'Halaga ng benta',
      },
      salesThisMonth: {
        label: 'Benta Ngayong Buwan',
        value: 'P5600',
        caption: 'Halaga ng benta',
      },
      itemsSoldToday: {
        label: 'Nabenta Ngayon',
        value: '8 piraso',
        caption: 'Nabenta ngayon',
      },
      topSelling: [
        {
          itemId: 'item-remote-1',
          itemName: 'Remote Sardines',
          detail: '15 cans na nabenta sa 30 araw',
        },
      ],
      lowStock: [],
      fastMoving: [],
      slowMoving: [],
      utangSummary: {
        totalBalance: 'P180',
        topCustomers: [
          {
            customerName: 'Mang Juan',
            balance: 'P180',
          },
        ],
      },
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
        { key: '7d', label: '7 araw', days: 7 },
        { key: '14d', label: '14 araw', days: 14 },
        { key: '30d', label: '1 buwan', days: 30 },
      ],
      shoppingListByPreset: {
        '7d': [
          {
            itemId: 'item-remote-1',
            itemName: 'Remote Sardines',
            unit: 'cans',
            currentStock: 3,
            averageDailyUnits: 1.7,
            horizonDays: 7,
            projectedUnitsNeeded: 12,
            recommendedBuyQuantity: 9,
            reason: '3 cans na lang · kailangan ng mga 12 sa susunod na 7 araw',
          },
        ],
        '14d': [
          {
            itemId: 'item-remote-1',
            itemName: 'Remote Sardines',
            unit: 'cans',
            currentStock: 3,
            averageDailyUnits: 1.7,
            horizonDays: 14,
            projectedUnitsNeeded: 24,
            recommendedBuyQuantity: 21,
            reason: '3 cans na lang · kailangan ng mga 24 sa susunod na 14 araw',
          },
        ],
        '30d': [],
      },
      recommendations: [
        {
          title: 'Simpleng Payo',
          body: 'Sabi ng AI, baka maubos ang Coke sa loob ng 3 araw.',
        },
      ],
      emptyState: null,
      modelStatus: 'gemini_enriched',
      aiSummary: 'Sabi ng AI, baka maubos ang Coke sa loob ng 3 araw.',
    },
  };
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      if (typeof message === 'string' && message.includes('An update to AnalyticsScreen inside a test was not wrapped in act')) {
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
    mockedCustomers = [
      {
        id: 'customer-1',
        storeId: 'store-1',
        name: 'Mang Juan',
        utangBalance: 80,
      },
    ];
    mockedIsAuthenticated = false;
    mockedNavigate.mockReset();
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
    const tree = await renderAnalyticsScreen();

    expect(findTextNodes(tree, 'Ganap sa Tindahan')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Buod')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Takbo ng Benta')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Pinakamabenta')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Malapit Maubos')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Nabenta Ngayon')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Kabuuang Utang')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Bibilhin')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Maaaring Maubos')).toHaveLength(0);
    expect(findPressables(tree)).toHaveLength(3);

    await act(async () => {
      findPressable(tree, 'Bantayan').props.onPress();
    });

    expect(findTextNodes(tree, 'Benta Ngayon')).toHaveLength(0);
    expect(findTextNodes(tree, 'Takbo ng Benta')).toHaveLength(0);
    expect(findTextNodes(tree, 'Mabilis Mabenta')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Mabagal Mabenta')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Nagbago Ngayong Linggo')).not.toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Bibilhin').props.onPress();
    });

    expect(findTextNodes(tree, 'Listahan ng Bibilhin')).not.toHaveLength(0);
    expect(findTextNodes(tree, '7 araw')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Maaaring Maubos')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Simpleng Payo')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Wala pang posibleng maubos agad.')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Buy Again')).toHaveLength(0);

    await act(async () => {
      findPressable(tree, '14 araw').props.onPress();
    });
  });

  it('shows an honest empty state when no real analytics data exists', async () => {
    mockedInventoryItems = [];

    const tree = await renderAnalyticsScreen();

    expect(findTextNodes(tree, 'Wala pang maipapakita')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Magdagdag ng unang paninda')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'P60')).toHaveLength(0);
    expect(findTextNodes(tree, 'Coke Mismo')).toHaveLength(0);
    expect(mockedFetchAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('routes the empty-state CTA to inventory setup', async () => {
    mockedInventoryItems = [];

    const tree = await renderAnalyticsScreen();

    await act(async () => {
      findPressable(tree, 'Magdagdag ng unang paninda').props.onPress();
    });

    expect(mockedNavigate).toHaveBeenCalledWith('Inventory', {
      openAddItemRequestId: 'analytics-empty-state',
    });
  });

  it('hydrates analytics from backend when authenticated and no pending transactions exist', async () => {
    mockedIsAuthenticated = true;
    mockedFetchAnalyticsSummary.mockResolvedValue(buildRemoteSummary());

    const tree = await renderAnalyticsScreen();

    expect(mockedFetchAnalyticsSummary).toHaveBeenCalledWith('token-1');
    expect(findTextNodes(tree, 'P999')).not.toHaveLength(0);
    expect(findTextNodes(tree, '8 piraso')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Remote Sardines')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'P180')).not.toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Bibilhin').props.onPress();
    });

    expect(findTextNodes(tree, 'Batay sa AI at benta')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Sabi ng AI, baka maubos ang Coke sa loob ng 3 araw.')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Bumili ng 9 cans')).not.toHaveLength(0);
  });

  it('keeps buy-tab hero short when the same stock details appear in lower sections', async () => {
    mockedLoadAnalyticsSalesRows.mockResolvedValue([
      {
        itemId: 'item-coke',
        itemName: 'Coke Mismo',
        unit: 'pcs',
        quantityDelta: -5,
        unitPrice: 20,
        lineTotal: 100,
        occurredAt: '2026-04-25T08:00:00.000Z',
        isUtang: false,
      },
      {
        itemId: 'item-coke',
        itemName: 'Coke Mismo',
        unit: 'pcs',
        quantityDelta: -4,
        unitPrice: 20,
        lineTotal: 80,
        occurredAt: '2026-04-24T08:00:00.000Z',
        isUtang: false,
      },
    ]);

    const tree = await renderAnalyticsScreen();

    await act(async () => {
      findPressable(tree, 'Bibilhin').props.onPress();
    });

    expect(findTextNodes(tree, 'Coke Mismo')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'bawat araw')).toHaveLength(1);
  });

  it('keeps the full analytics model local when pending transactions exist', async () => {
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

    const tree = await renderAnalyticsScreen();

    expect(findTextNodes(tree, 'Coke Mismo')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'P999')).toHaveLength(0);
    expect(findTextNodes(tree, 'Remote Sardines')).toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Bibilhin').props.onPress();
    });

    expect(findTextNodes(tree, 'Sabi ng AI, baka maubos ang Coke sa loob ng 3 araw.')).toHaveLength(0);
    expect(findTextNodes(tree, 'Batay sa tala sa phone')).not.toHaveLength(0);
  });

  it('shows skeleton while analytics are still loading', async () => {
    mockedLoadAnalyticsSalesRows.mockImplementation(
      () => new Promise<AnalyticsSalesRow[]>((resolve) => setTimeout(() => resolve([]), 30)),
    );

    const tree = await renderAnalyticsScreen();

    expect(findTextNodes(tree, 'Kinukuha ang galaw ng tindahan...')).not.toHaveLength(0);
  });

  it('supports pull-to-refresh to rerun analytics loading', async () => {
    mockedIsAuthenticated = true;
    mockedFetchAnalyticsSummary.mockResolvedValue(buildRemoteSummary());

    const tree = await renderAnalyticsScreen();

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
