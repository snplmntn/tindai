import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

import type { LocalInventoryItem } from '@/features/local-db/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

const mockedApplyManualAdjustment = vi.fn<(itemId: string, direction: -1 | 1) => Promise<void>>(async () => undefined);
const mockedCreateLocalInventoryItem = vi.fn<
  (entry: { name: string; quantity: number; cost: number; price: number }) => Promise<void>
>(async () => undefined);
const mockedUpdateInventoryItemMetadata = vi.fn<
  (entry: { itemId: string; name: string; cost: number; price: number; lowStockThreshold: number }) => Promise<void>
>(async () => undefined);
const mockedArchiveLocalInventoryItem = vi.fn<(itemId: string) => Promise<void>>(async () => undefined);
const mockedSetParams = vi.fn();
let mockedInventoryRouteParams: { openAddItemRequestId?: string } = {};

let mockedInventoryItems: LocalInventoryItem[] = [];
let mockedPendingTransactions: Array<{
  id: string;
  rawText: string;
  createdAt: string;
  source: 'voice' | 'typed' | 'manual';
  intent: string | null;
  primaryItemName: string | null;
  primaryQuantityDelta: number | null;
}> = [];

vi.mock('react-native', () => ({
  ActivityIndicator: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('mock-activity-indicator', props, children),
  Modal: ({ children, visible, ...props }: { children?: React.ReactNode; visible?: boolean }) =>
    visible ? createElement('mock-modal', props, children) : null,
  Pressable: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-pressable', props, children),
  ScrollView: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('mock-scroll-view', props, children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Text: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text', props, children),
  TextInput: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text-input', props, children),
  TouchableOpacity: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('mock-touchable-opacity', props, children),
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

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    setParams: mockedSetParams,
  }),
  useRoute: () => ({
    params: mockedInventoryRouteParams,
  }),
  useIsFocused: () => true,
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  useLocalData: () => ({
    appState: {
      mode: 'authenticated',
    },
    store: {
      id: 'store-1',
      ownerId: 'user-1',
      name: 'Mercado Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    },
    inventoryItems: mockedInventoryItems,
    pendingTransactions: mockedPendingTransactions,
    applyManualAdjustment: mockedApplyManualAdjustment,
    createLocalInventoryItem: mockedCreateLocalInventoryItem,
    updateInventoryItemMetadata: mockedUpdateInventoryItemMetadata,
    archiveLocalInventoryItem: mockedArchiveLocalInventoryItem,
  }),
}));

import { InventoryScreen } from './InventoryScreen';

function buildItem(overrides: Partial<LocalInventoryItem>): LocalInventoryItem {
  return {
    id: 'item-1',
    storeId: 'store-1',
    name: 'Softdrink Mismo',
    aliases: ['coke'],
    unit: 'pcs',
    cost: 12,
    price: 20,
    currentStock: 8,
    lowStockThreshold: 4,
    updatedAt: '2026-04-25T00:00:00.000Z',
    ...overrides,
  };
}

function findByTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.find((node) => node.props.testID === testID);
}

function findAllByTestIdPrefix(tree: TestRenderer.ReactTestRenderer, prefix: string) {
  return tree.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(prefix));
}

function findTextNodes(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node) =>
      String(node.type) === 'mock-text' &&
      node.children.some((child) => typeof child === 'string' && child.includes(text)),
  );
}

function getRenderedItemNames(tree: TestRenderer.ReactTestRenderer) {
  return findAllByTestIdPrefix(tree, 'item-name-')
    .filter((node) => String(node.type) === 'mock-text')
    .map((node) =>
    node.children.filter((child) => typeof child === 'string').join(''),
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

    mockedApplyManualAdjustment.mockClear();
    mockedCreateLocalInventoryItem.mockClear();
    mockedUpdateInventoryItemMetadata.mockClear();
    mockedArchiveLocalInventoryItem.mockClear();
    mockedSetParams.mockReset();
    mockedInventoryRouteParams = {};
    mockedInventoryItems = [
      buildItem({
        id: 'item-softdrink',
        name: 'Softdrink Mismo',
        aliases: ['coke'],
        currentStock: 8,
        lowStockThreshold: 4,
      }),
      buildItem({
        id: 'item-sardines',
        name: 'Lucky 7 Sardines',
        aliases: ['555'],
        currentStock: 2,
        lowStockThreshold: 3,
        price: 28,
      }),
      buildItem({
        id: 'item-noodles',
        name: 'Pancit Canton',
        aliases: ['noodles'],
        currentStock: 5,
        lowStockThreshold: 5,
        price: 18,
      }),
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

  it('renders the inventory list from local data with pending sync panel', async () => {
    const tree = await renderInventoryScreen();

    expect(findTextNodes(tree, 'Paninda')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Bawas 2 Coke')).not.toHaveLength(0);
    expect(getRenderedItemNames(tree)).toEqual(['Lucky 7 Sardines', 'Pancit Canton', 'Softdrink Mismo']);
  });

  it('filters by item name and aliases', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findByTestId(tree, 'inventory-search-input').props.onChangeText('555');
    });

    expect(getRenderedItemNames(tree)).toEqual(['Lucky 7 Sardines']);

    await act(async () => {
      findByTestId(tree, 'inventory-search-input').props.onChangeText('softdrink');
    });

    expect(getRenderedItemNames(tree)).toEqual(['Softdrink Mismo']);
  });

  it('calls applyManualAdjustment for quick adjust actions', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findByTestId(tree, 'inventory-adjust-minus-item-softdrink').props.onPress();
      findByTestId(tree, 'inventory-adjust-plus-item-softdrink').props.onPress();
      await Promise.resolve();
    });

    expect(mockedApplyManualAdjustment).toHaveBeenNthCalledWith(1, 'item-softdrink', -1);
    expect(mockedApplyManualAdjustment).toHaveBeenNthCalledWith(2, 'item-softdrink', 1);
  });

  it('submits the add item modal through createLocalInventoryItem', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findByTestId(tree, 'inventory-add-open-button').props.onPress();
    });

    await act(async () => {
      findByTestId(tree, 'inventory-add-name-input').props.onChangeText('Bear Brand');
      findByTestId(tree, 'inventory-add-quantity-input').props.onChangeText('6');
      findByTestId(tree, 'inventory-add-cost-input').props.onChangeText('14.5');
      findByTestId(tree, 'inventory-add-price-input').props.onChangeText('18');
    });

    await act(async () => {
      findByTestId(tree, 'inventory-add-submit-button').props.onPress();
      await Promise.resolve();
    });

    expect(mockedCreateLocalInventoryItem).toHaveBeenCalledWith({
      name: 'Bear Brand',
      quantity: 6,
      cost: 14.5,
      price: 18,
    });
  });

  it('opens the add item modal immediately when inventory is requested from analytics', async () => {
    mockedInventoryRouteParams = { openAddItemRequestId: 'analytics-empty-state' };

    const tree = await renderInventoryScreen();

    expect(findTextNodes(tree, 'Magdagdag ng item')).not.toHaveLength(0);
    expect(findByTestId(tree, 'inventory-add-name-input')).toBeDefined();
    expect(mockedSetParams).toHaveBeenCalledWith({ openAddItemRequestId: undefined });
  });

  it('shows an empty inventory state when there are no items yet', async () => {
    mockedInventoryItems = [];

    const tree = await renderInventoryScreen();

    expect(findByTestId(tree, 'inventory-empty-state')).toBeDefined();
    expect(findTextNodes(tree, 'Wala pang item')).not.toHaveLength(0);
    expect(getRenderedItemNames(tree)).toEqual([]);
  });

  it('submits item edits through updateInventoryItemMetadata', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findByTestId(tree, 'inventory-open-item-item-softdrink').props.onPress();
    });

    await act(async () => {
      findByTestId(tree, 'inventory-edit-open-button').props.onPress();
    });

    await act(async () => {
      findByTestId(tree, 'inventory-edit-name-input').props.onChangeText('Softdrink Mismo Plus');
      findByTestId(tree, 'inventory-edit-cost-input').props.onChangeText('13');
      findByTestId(tree, 'inventory-edit-price-input').props.onChangeText('21');
      findByTestId(tree, 'inventory-edit-threshold-input').props.onChangeText('6');
    });

    await act(async () => {
      findByTestId(tree, 'inventory-edit-submit-button').props.onPress();
      await Promise.resolve();
    });

    expect(mockedUpdateInventoryItemMetadata).toHaveBeenCalledWith({
      itemId: 'item-softdrink',
      name: 'Softdrink Mismo Plus',
      cost: 13,
      price: 21,
      lowStockThreshold: 6,
    });
  });

  it('archives an item from the detail sheet', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findByTestId(tree, 'inventory-open-item-item-softdrink').props.onPress();
    });

    await act(async () => {
      findByTestId(tree, 'inventory-archive-button').props.onPress();
      await Promise.resolve();
    });

    expect(mockedArchiveLocalInventoryItem).toHaveBeenCalledWith('item-softdrink');
  });

  it('shows a no-results state when search filters remove all items', async () => {
    const tree = await renderInventoryScreen();

    await act(async () => {
      findByTestId(tree, 'inventory-search-input').props.onChangeText('walang tugma');
    });

    expect(findByTestId(tree, 'inventory-no-results-state')).toBeDefined();
    expect(findTextNodes(tree, 'Walang tumugma')).not.toHaveLength(0);
  });
});
