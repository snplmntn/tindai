import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

let mockedInventoryItems = [
  {
    id: 'item-softdrink',
    storeId: 'store-1',
    name: 'Softdrink Mismo',
    aliases: ['coke'],
    unit: 'pcs',
    price: 20,
    currentStock: 8,
    lowStockThreshold: 4,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

let mockedPendingTransactions = [
  {
    id: 'pending-1',
    rawText: 'Bawas 2 Coke',
    createdAt: '2026-04-25T02:00:00.000Z',
    source: 'typed',
    intent: 'sale',
    primaryItemName: 'Softdrink Mismo',
    primaryQuantityDelta: -2,
  },
];

vi.mock('react-native', () => ({
  Pressable: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-pressable', props, children),
  ScrollView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-scroll-view', props, children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Text: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text', props, children),
  View: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-view', props, children),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('safe-area-view', props, children),
}));

vi.mock('@/navigation/colors', () => ({
  colors: {
    background: '#FAFBF8',
    surface: '#FFFFFF',
    card: '#EDF6EF',
    text: '#1F2925',
    muted: '#66706B',
    primaryDeep: '#145746',
    border: 'rgba(31, 122, 99, 0.14)',
  },
}));

vi.mock('@/components/ClientTabLayout', () => ({
  ClientTabLayout: ({
    children,
    label,
    title,
    subtitle,
    highlights,
  }: {
    children?: React.ReactNode;
    label: string;
    title: string;
    subtitle: string;
    highlights: string[];
  }) =>
    createElement(
      'mock-layout',
      { label, title, subtitle, highlights },
      createElement('mock-text', null, label),
      createElement('mock-text', null, title),
      createElement('mock-text', null, subtitle),
      ...highlights.map((highlight) => createElement('mock-text', { key: highlight }, highlight)),
      children,
    ),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'token-1' } },
      }),
    },
  },
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  useLocalData: () => ({
    appState: { mode: 'authenticated' },
    inventoryItems: mockedInventoryItems,
    pendingTransactions: mockedPendingTransactions,
  }),
}));

vi.mock('@/features/receipt-scan/ReceiptCaptureFlow', () => ({
  ReceiptCaptureFlow: ({ visible }: { visible: boolean }) =>
    visible ? createElement('mock-text', null, 'receipt-capture-open') : null,
}));

vi.mock('@/features/receipt-scan/ReceiptReviewPanel', () => ({
  ReceiptReviewPanel: () => createElement('mock-text', null, 'receipt-review-panel'),
}));

vi.mock('@/features/receipt-scan/receiptCapture', () => ({
  cleanupReceiptImageDraft: vi.fn(),
  formatReceiptFileSize: (fileSize: number) => `${fileSize} bytes`,
}));

vi.mock('@/features/receipt-scan/receiptApi', () => ({
  sendReceiptOcrToBackend: vi.fn(),
  parseReceiptOnBackend: vi.fn(),
  matchReceiptOnBackend: vi.fn(),
}));

vi.mock('@/features/receipt-scan/receiptOcr', () => ({
  extractReceiptText: vi.fn(),
  assessReceiptOcrText: vi.fn(() => ({ status: 'weak', message: 'Mahina ang basa' })),
}));

vi.mock('@/features/receipt-scan/receiptReview', () => ({
  createReceiptReviewSession: vi.fn(),
  getReceiptReviewSummary: vi.fn(() => ({ unresolvedCount: 0 })),
}));

import { InventoryScreen } from './InventoryScreen';

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

async function renderInventoryScreen() {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(createElement(InventoryScreen));
    await Promise.resolve();
  });

  return tree;
}

describe('InventoryScreen', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

    mockedInventoryItems = [
      {
        id: 'item-softdrink',
        storeId: 'store-1',
        name: 'Softdrink Mismo',
        aliases: ['coke'],
        unit: 'pcs',
        price: 20,
        currentStock: 8,
        lowStockThreshold: 4,
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    ];
    mockedPendingTransactions = [
      {
        id: 'pending-1',
        rawText: 'Bawas 2 Coke',
        createdAt: '2026-04-25T02:00:00.000Z',
        source: 'typed',
        intent: 'sale',
        primaryItemName: 'Softdrink Mismo',
        primaryQuantityDelta: -2,
      },
    ];
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('renders the merged inventory hero and receipt entry point', async () => {
    const tree = await renderInventoryScreen();

    expect(findTextNodes(tree, 'Paninda')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Hanapin, silipin, at ayusin agad ang paninda mo.')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Ihanda ang resibo ng restock')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Kuhanan ang resibo')).not.toHaveLength(0);
  });

  it('shows pending sync entries in the merged inventory layout', async () => {
    const tree = await renderInventoryScreen();

    expect(findTextNodes(tree, 'Naghihintay maipadala')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Bawas 2 Coke')).not.toHaveLength(0);
  });

  it('opens the receipt capture flow from the inventory screen', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findPressable(tree, 'Kuhanan ang resibo').props.onPress();
    });

    expect(findTextNodes(tree, 'receipt-capture-open')).not.toHaveLength(0);
  });
});
