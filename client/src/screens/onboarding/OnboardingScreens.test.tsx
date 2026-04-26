import { act, createElement } from 'react';
import TestRenderer from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockedChooseGuestMode = vi.fn(async () => undefined);
const mockedShowLogin = vi.fn(async () => undefined);
const mockedShowSignUp = vi.fn(async () => undefined);
const mockedCloseAuth = vi.fn(async () => undefined);
const mockedSignInWithEmail = vi.fn(async () => undefined);
const mockedSignUpWithEmail = vi.fn(async () => undefined);
const mockedClearAuthError = vi.fn();
const mockedRequestMicrophonePermission = vi.fn(async () => 'granted');
const mockedRequestStoragePermission = vi.fn(async () => 'granted');
const mockedCompleteOnboarding = vi.fn(async () => undefined);
const mockedOnDismiss = vi.fn();
const originalConsoleError = console.error;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let mockedMicrophonePermission: 'pending' | 'granted' | 'denied' = 'pending';
let mockedStoragePermission: 'pending' | 'granted' | 'denied' = 'pending';

vi.mock('@expo/vector-icons', () => ({
  Feather: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-icon', props),
  FontAwesome: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-icon', props),
  Ionicons: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-icon', props),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('mock-linear-gradient', props, children),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('safe-area-view', props, children),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-activity-indicator', props),
  Image: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-image', props),
  KeyboardAvoidingView: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('mock-keyboard-avoiding-view', props, children),
  Platform: { OS: 'android' },
  Pressable: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-pressable', props, children),
  ScrollView: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-scroll-view', props, children),
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text', props, children),
  TextInput: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text-input', props, children),
  View: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-view', props, children),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    chooseGuestMode: mockedChooseGuestMode,
    showLogin: mockedShowLogin,
    showSignUp: mockedShowSignUp,
    closeAuth: mockedCloseAuth,
    signInWithEmail: mockedSignInWithEmail,
    signUpWithEmail: mockedSignUpWithEmail,
    authError: null,
    clearAuthError: mockedClearAuthError,
    microphonePermission: mockedMicrophonePermission,
    storagePermission: mockedStoragePermission,
    requestMicrophonePermission: mockedRequestMicrophonePermission,
    requestStoragePermission: mockedRequestStoragePermission,
    completeOnboarding: mockedCompleteOnboarding,
  }),
}));

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { AuthChoiceScreen } from './AuthChoiceScreen';
import { OnboardingOverlay } from './OnboardingOverlay';
import { PermissionsScreen } from './PermissionsScreen';

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

async function renderScreen(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(element);
    await Promise.resolve();
  });

  return tree;
}

describe('onboarding screens', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

    mockedMicrophonePermission = 'pending';
    mockedStoragePermission = 'pending';
    mockedChooseGuestMode.mockClear();
    mockedShowLogin.mockClear();
    mockedShowSignUp.mockClear();
    mockedCloseAuth.mockClear();
    mockedSignInWithEmail.mockClear();
    mockedSignUpWithEmail.mockClear();
    mockedClearAuthError.mockClear();
    mockedRequestMicrophonePermission.mockClear();
    mockedRequestStoragePermission.mockClear();
    mockedCompleteOnboarding.mockClear();
    mockedOnDismiss.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('renders step 1 start choices and keeps account and guest actions wired', async () => {
    const tree = await renderScreen(createElement(AuthChoiceScreen));

    expect(findTextNodes(tree, 'Hakbang 1 ng 4')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Madaling Simula')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Boses-una na inventory para sa tindahan mo.')).not.toHaveLength(0);

    await act(async () => {
      await findPressable(tree, 'Mag-sign In o Gumawa ng Account').props.onPress();
    });
    await act(async () => {
      await findPressable(tree, 'Simulan bilang Guest').props.onPress();
    });

    expect(mockedShowLogin).toHaveBeenCalledTimes(1);
    expect(mockedChooseGuestMode).toHaveBeenCalledTimes(1);
  });

  it('renders step 2 account connection shell around the login handlers', async () => {
    const tree = await renderScreen(createElement(LoginScreen));

    expect(findTextNodes(tree, 'Hakbang 2 ng 4')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Madaling Simula')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Back to Dashboard')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Ikonekta ang account mo.')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Magpatuloy')).not.toHaveLength(0);
    expect(tree.root.findAll((node) => String(node.type) === 'mock-icon' && node.props.name === 'eye')).not.toHaveLength(0);
  });

  it('renders step 3 permissions and completes through existing permission handlers', async () => {
    const tree = await renderScreen(createElement(PermissionsScreen));

    expect(findTextNodes(tree, 'Hakbang 3 ng 4')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Madaling Simula')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Kailangan namin ng kaunting pahintulot.')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Mikropono')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Storage')).not.toHaveLength(0);

    await act(async () => {
      await findPressable(tree, 'Payagan at Magpatuloy').props.onPress();
    });

    expect(mockedRequestMicrophonePermission).toHaveBeenCalledTimes(1);
    expect(mockedRequestStoragePermission).toHaveBeenCalledTimes(1);
    expect(mockedCompleteOnboarding).toHaveBeenCalledTimes(1);
  });

  it('renders step 4 tutorial completion and keeps dismiss wired', async () => {
    const tree = await renderScreen(createElement(OnboardingOverlay, { onDismiss: mockedOnDismiss }));

    expect(findTextNodes(tree, 'Hakbang 4 ng 4')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Handa ka na!')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Nakabenta ako ng tatlong Lucky Me at isang Coke Mismo.')).not.toHaveLength(0);

    await act(async () => {
      findPressable(tree, 'Simulan na ang paggamit').props.onPress();
    });

    expect(mockedOnDismiss).toHaveBeenCalledTimes(1);
  });
});
