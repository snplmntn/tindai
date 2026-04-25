import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

import type { LocalUtangCustomerLedger, LocalUtangEntrySummary } from '@/features/local-db/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

let mockedUtangCustomers: LocalUtangCustomerLedger[] = [];
let mockedUtangEntries: LocalUtangEntrySummary[] = [];

vi.mock('react-native', () => ({
  Pressable: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-pressable', props, children),
  ScrollView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-scroll-view', props, children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Text: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text', props, children),
  TextInput: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text-input', props, children),
  View: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-view', props, children),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('safe-area-view', props, children),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@/navigation/colors', () => ({
  colors: {
    background: '#FAFBF8',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F8F2',
    card: '#EDF6EF',
    text: '#1F2925',
    muted: '#66706B',
    primary: '#1F7A63',
    primaryDeep: '#145746',
    secondary: '#F2C94C',
    accent: '#D9A93F',
    border: 'rgba(31, 122, 99, 0.14)',
  },
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  useLocalData: () => ({
    store: {
      id: 'store-1',
      ownerId: 'user-1',
      name: 'Mercado Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    },
    utangCustomers: mockedUtangCustomers,
    recentUtangEntries: mockedUtangEntries,
  }),
}));

import { UtangScreen } from './UtangScreen';

function findByTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.find((node) => node.props.testID === testID);
}

function findTextNodes(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node) =>
      String(node.type) === 'mock-text' &&
      node.children.some((child) => typeof child === 'string' && child.includes(text)),
  );
}

function getRenderedCustomerNames(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll(
      (node) =>
        String(node.type) === 'mock-text' &&
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('utang-customer-name-'),
    )
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''));
}

async function renderUtangScreen() {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(createElement(UtangScreen));
    await Promise.resolve();
  });

  return tree;
}

describe('UtangScreen', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

    mockedUtangCustomers = [
      {
        customerId: 'customer-1',
        customerName: 'Mang Juan',
        utangBalance: 150,
        entryCount: 2,
        latestEntryAt: '2026-04-25T12:00:00.000Z',
        itemSummary: '2x Coke Mismo, 1x Lucky 7 Sardines',
      },
      {
        customerId: 'customer-2',
        customerName: 'Aling Rosa',
        utangBalance: 60,
        entryCount: 1,
        latestEntryAt: '2026-04-25T10:00:00.000Z',
        itemSummary: '3x Pancit Canton',
      },
    ];
    mockedUtangEntries = [
      {
        entryId: 'utang-1',
        customerId: 'customer-1',
        customerName: 'Mang Juan',
        amount: 40,
        note: 'Kumuha si Mang Juan ng dalawang Coke, ilista mo muna.',
        createdAt: '2026-04-25T12:00:00.000Z',
        syncStatus: 'pending',
        itemSummary: '2x Coke Mismo',
      },
      {
        entryId: 'utang-2',
        customerId: 'customer-2',
        customerName: 'Aling Rosa',
        amount: 60,
        note: 'Tatlong Pancit Canton muna kay Aling Rosa.',
        createdAt: '2026-04-25T10:00:00.000Z',
        syncStatus: 'synced',
        itemSummary: '3x Pancit Canton',
      },
    ];
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('renders customer totals first and recent utang entries underneath', async () => {
    const tree = await renderUtangScreen();

    expect(findTextNodes(tree, 'Utang')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Mang Juan')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Aling Rosa')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Recent na lista')).not.toHaveLength(0);
    expect(findTextNodes(tree, '2x Coke Mismo')).not.toHaveLength(0);
  });

  it('filters customers by customer name and item summary', async () => {
    const tree = await renderUtangScreen();

    await act(async () => {
      findByTestId(tree, 'utang-search-input').props.onChangeText('pancit');
    });

    expect(getRenderedCustomerNames(tree)).toEqual(['Aling Rosa']);
  });

  it('shows an empty utang state when there are no unpaid customers or entries yet', async () => {
    mockedUtangCustomers = [];
    mockedUtangEntries = [];

    const tree = await renderUtangScreen();

    expect(findByTestId(tree, 'utang-empty-state')).toBeDefined();
    expect(findTextNodes(tree, 'Wala pang nakalistang utang')).not.toHaveLength(0);
  });

  it('shows a no-results state when search removes all ledger rows', async () => {
    const tree = await renderUtangScreen();

    await act(async () => {
      findByTestId(tree, 'utang-search-input').props.onChangeText('walang tugma');
    });

    expect(findByTestId(tree, 'utang-no-results-state')).toBeDefined();
    expect(findTextNodes(tree, 'Walang tumugma')).not.toHaveLength(0);
  });
});
