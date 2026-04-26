import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const receiptCaptureModuleMocks = vi.hoisted(() => ({
  cleanupReceiptImageDraft: vi.fn(async () => undefined),
}));

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

const mockedRefresh = vi.fn(async () => undefined);
const mockedShowLogin = vi.fn(async () => undefined);
const mockedRequestMicrophonePermission = vi.fn(async () => 'granted');
const mockedOpenDeviceSettings = vi.fn(async () => undefined);
const mockedSubmitLocalCommand = vi.fn();
const mockedConfirmLocalCommand = vi.fn();
const mockedApplyManualAdjustment = vi.fn(async () => undefined);
const mockedSubmitFallbackCommand = vi.fn(async () => undefined);
const mockedCreateLocalCustomer = vi.fn(async (name: string) => ({ id: 'customer-2', name }));
const mockedCreateLocalInventoryItem = vi.fn(async () => undefined);
const mockedSubmitAssistantQuestion = vi.fn();
const mockedReceiptCaptureFlow = vi.fn(
  ({
    visible,
  }: {
    visible: boolean;
    onClose: () => void;
    onSaveDraft: (draft: unknown) => Promise<void> | void;
  }) => (visible ? createElement('mock-receipt-capture-flow') : null),
);

let mockedAuthMode: 'guest' | 'authenticated' = 'authenticated';
let mockedMicrophonePermission: 'granted' | 'denied' | 'pending' = 'granted';
let mockedAppMode: 'guest' | 'authenticated' = 'authenticated';
let mockedSyncNotice: string | null = null;
let mockedBottomInset = 0;

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-icon', props),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-activity-indicator', props),
  Modal: ({ children, visible, ...props }: { children?: React.ReactNode; visible?: boolean }) =>
    visible ? createElement('mock-modal', props, children) : null,
  Pressable: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-pressable', props, children),
  ScrollView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-scroll-view', props, children),
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
  useSafeAreaInsets: () => ({
    top: 0,
    right: 0,
    bottom: mockedBottomInset,
    left: 0,
  }),
}));

vi.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => true,
    requestPermissionsAsync: async () => ({ granted: true }),
    start: () => undefined,
    stop: () => undefined,
  },
  useSpeechRecognitionEvent: () => undefined,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    authMode: mockedAuthMode,
    microphonePermission: mockedMicrophonePermission,
    requestMicrophonePermission: mockedRequestMicrophonePermission,
    openDeviceSettings: mockedOpenDeviceSettings,
    showLogin: mockedShowLogin,
  }),
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  useLocalData: () => ({
    appState: { mode: mockedAppMode },
    store: { id: 'store-1', name: 'Mercado Store', currencyCode: 'PHP', timezone: 'Asia/Manila', ownerId: 'user-1', updatedAt: '2026-04-26T00:00:00.000Z' },
    inventoryItems: [
      {
        id: 'item-1',
        storeId: 'store-1',
        name: 'Coke Mismo',
        aliases: ['coke'],
        unit: 'pcs',
        cost: 10,
        price: 20,
        currentStock: 3,
        lowStockThreshold: 5,
        updatedAt: '2026-04-26T00:00:00.000Z',
      },
    ],
    customers: [{ id: 'customer-1', name: 'Mang Juan' }],
    assistantInteractions: [],
    pendingTransactions: [],
    isLoading: false,
    error: null,
    syncNotice: mockedSyncNotice,
    refresh: mockedRefresh,
    submitLocalCommand: mockedSubmitLocalCommand,
    confirmLocalCommand: mockedConfirmLocalCommand,
    applyManualAdjustment: mockedApplyManualAdjustment,
    submitFallbackCommand: mockedSubmitFallbackCommand,
    createLocalCustomer: mockedCreateLocalCustomer,
    createLocalInventoryItem: mockedCreateLocalInventoryItem,
    submitAssistantQuestion: mockedSubmitAssistantQuestion,
  }),
}));

vi.mock('@/features/assistant/assistantLanguageDetection', () => ({
  detectLanguageStyle: () => 'tagalog',
}));

vi.mock('@/services/ttsService', () => ({
  getLanguageCode: () => 'fil-PH',
  speakText: async () => ({ spoken: true, fallbackUsed: false }),
  stopSpeaking: async () => undefined,
}));

vi.mock('@/features/receipt-scan/ReceiptCaptureFlow', () => ({
  ReceiptCaptureFlow: (props: {
    visible: boolean;
    onClose: () => void;
    onSaveDraft: (draft: unknown) => Promise<void> | void;
  }) => mockedReceiptCaptureFlow(props),
}));

vi.mock('@/features/receipt-scan/receiptCapture', () => ({
  cleanupReceiptImageDraft: receiptCaptureModuleMocks.cleanupReceiptImageDraft,
}));

import { DashboardScreen } from './DashboardScreen';

function findTextNodes(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node) =>
      String(node.type) === 'mock-text' &&
      node.children.some((child) => typeof child === 'string' && child.includes(text)),
  );
}

function findByTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.find((node) => node.props.testID === testID);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (accumulator, current) => ({
        ...accumulator,
        ...flattenStyle(current),
      }),
      {},
    );
  }

  return typeof style === 'object' && style !== null ? (style as Record<string, unknown>) : {};
}

function findIconNodes(tree: TestRenderer.ReactTestRenderer, name: string) {
  return tree.root.findAll((node) => String(node.type) === 'mock-icon' && node.props.name === name);
}

async function renderDashboardScreen() {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(createElement(DashboardScreen));
    await Promise.resolve();
  });

  return tree;
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

    mockedAuthMode = 'authenticated';
    mockedMicrophonePermission = 'granted';
    mockedAppMode = 'authenticated';
    mockedSyncNotice = null;
    mockedBottomInset = 0;
    mockedRefresh.mockClear();
    mockedShowLogin.mockClear();
    mockedRequestMicrophonePermission.mockClear();
    mockedOpenDeviceSettings.mockClear();
    mockedSubmitLocalCommand.mockReset();
    mockedConfirmLocalCommand.mockReset();
    mockedApplyManualAdjustment.mockClear();
    mockedSubmitFallbackCommand.mockClear();
    mockedCreateLocalCustomer.mockClear();
    mockedCreateLocalInventoryItem.mockClear();
    mockedSubmitAssistantQuestion.mockReset();
    mockedReceiptCaptureFlow.mockClear();
    receiptCaptureModuleMocks.cleanupReceiptImageDraft.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('renders the migrated dashboard hero and summary headings', async () => {
    const tree = await renderDashboardScreen();

    expect(findTextNodes(tree, 'Tindahan')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Tap para magsalita ng utos')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Produkto')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'BOSIS')).toHaveLength(0);
    expect(findTextNodes(tree, 'Hindi pa puwede ang voice input dito')).toHaveLength(0);
  });

  it('shows guest backup messaging and the add-item action', async () => {
    mockedAuthMode = 'guest';
    mockedAppMode = 'guest';

    const tree = await renderDashboardScreen();

    expect(findTextNodes(tree, 'Sa phone lang naka-save ang data mo.')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Mag-log in')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Magdagdag ng item')).not.toHaveLength(0);
  });

  it('keeps the inventory controls visible in the migrated layout', async () => {
    const tree = await renderDashboardScreen();

    expect(findTextNodes(tree, 'Coke Mismo')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Malapit maubos')).not.toHaveLength(0);
    expect(findIconNodes(tree, 'remove')).not.toHaveLength(0);
    expect(findIconNodes(tree, 'add')).not.toHaveLength(0);
  });

  it('shows stock change success as an icon above the mic', async () => {
    const tree = await renderDashboardScreen();
    const inventoryRemoveButton = tree.root.findAll(
      (node) =>
        String(node.type) === 'mock-touchable-opacity' &&
        node.findAll(
          (child) =>
            String(child.type) === 'mock-icon' && child.props.name === 'remove',
        ).length > 0,
    )[0];

    await act(async () => {
      inventoryRemoveButton.props.onPress();
    });

    expect(findByTestId(tree, 'dashboard-stock-change-success')).not.toBeUndefined();
    expect(findTextNodes(tree, 'Nabago na ang bilang. Hihintayin lang ang internet para maipadala.')).toHaveLength(0);
  });

  it('renders the quick-entry sheet edge to edge above the tab bar', async () => {
    const tree = await renderDashboardScreen();

    await act(async () => {
      findByTestId(tree, 'dashboard-fallback-trigger').props.onPress();
    });

    expect(findByTestId(tree, 'dashboard-fallback-backdrop').props.style).toMatchObject({
      padding: 0,
    });
    expect(flattenStyle(findByTestId(tree, 'dashboard-fallback-sheet').props.style)).toMatchObject({
      width: '100%',
      alignSelf: 'stretch',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    });
  });

  it('keeps the quick-entry actions close to the bottom when there is no device inset', async () => {
    const tree = await renderDashboardScreen();

    await act(async () => {
      findByTestId(tree, 'dashboard-fallback-trigger').props.onPress();
    });

    expect(flattenStyle(findByTestId(tree, 'dashboard-fallback-sheet').props.style)).toMatchObject({
      paddingBottom: 12,
    });
  });

  it('opens the receipt photo flow from the add-item actions', async () => {
    const tree = await renderDashboardScreen();

    expect(mockedReceiptCaptureFlow).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: false,
      }),
    );

    await act(async () => {
      findByTestId(tree, 'dashboard-receipt-trigger').props.onPress();
    });

    expect(mockedReceiptCaptureFlow).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: true,
      }),
    );
    expect(
      tree.root.findAll((node) => String(node.type) === 'mock-receipt-capture-flow'),
    ).toHaveLength(1);
  });

  it('keeps the saved receipt draft intact for the next step', async () => {
    const tree = await renderDashboardScreen();

    const receiptDraft = {
      id: 'receipt-1',
      source: 'gallery',
      originalUri: 'file:///receipt-original.jpg',
      compressedUri: 'file:///receipt.jpg',
      tempPath: '/tmp/receipt.jpg',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 1800,
      fileSize: 120000,
      createdAt: '2026-04-26T00:00:00.000Z',
      qualityIssues: [],
    };

    await act(async () => {
      await mockedReceiptCaptureFlow.mock.lastCall?.[0].onSaveDraft(receiptDraft);
    });

    expect(receiptCaptureModuleMocks.cleanupReceiptImageDraft).not.toHaveBeenCalled();
    expect(findTextNodes(tree, 'Nakuha na ang larawan ng resibo.')).not.toHaveLength(0);
  });
});
