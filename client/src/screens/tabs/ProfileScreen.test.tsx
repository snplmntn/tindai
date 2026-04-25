import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

const mockedSignOut = vi.fn(async () => undefined);
const mockedShowLogin = vi.fn();
const mockedShowSignUp = vi.fn();
const mockedFetchMyProfile = vi.fn();
const mockedUpdateMyProfile = vi.fn();
const mockedClearMyProfileAvatar = vi.fn();
const mockedUpdateMyStoreName = vi.fn();
const mockedGetSession = vi.fn();
const mockedRefresh = vi.fn(async () => undefined);

let mockedIsAuthenticated = true;
let mockedStoreName: string | null = 'Mercado Store';

vi.mock('react-native', () => ({
  Image: ({ ...props }: { children?: React.ReactNode }) => createElement('mock-image', props),
  Pressable: ({ children, ...props }: { children: React.ReactNode }) => createElement('mock-pressable', props, children),
  ScrollView: ({ children, ...props }: { children: React.ReactNode }) => createElement('mock-scroll-view', props, children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Text: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text', props, children),
  TextInput: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-text-input', props, children),
  View: ({ children, ...props }: { children?: React.ReactNode }) => createElement('mock-view', props, children),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => createElement('safe-area-view', props, children),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockedIsAuthenticated,
    signOut: mockedSignOut,
    showLogin: mockedShowLogin,
    showSignUp: mockedShowSignUp,
  }),
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  useLocalData: () => ({
    store: mockedStoreName ? { name: mockedStoreName } : null,
    refresh: mockedRefresh,
  }),
}));

vi.mock('@/features/profile/profileApi', () => ({
  fetchMyProfile: (...args: unknown[]) => mockedFetchMyProfile(...args),
  updateMyProfile: (...args: unknown[]) => mockedUpdateMyProfile(...args),
  clearMyProfileAvatar: (...args: unknown[]) => mockedClearMyProfileAvatar(...args),
  updateMyStoreName: (...args: unknown[]) => mockedUpdateMyStoreName(...args),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockedGetSession(...args),
    },
  },
}));

import { ProfileScreen } from './ProfileScreen';

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

function findTextInputByValue(tree: TestRenderer.ReactTestRenderer, value: string) {
  return tree.root.find(
    (node) => String(node.type) === 'mock-text-input' && typeof node.props.value === 'string' && node.props.value === value,
  );
}

function findImages(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((node) => String(node.type) === 'mock-image');
}

async function renderProfileScreen() {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(createElement(ProfileScreen));
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree;
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

    mockedIsAuthenticated = true;
    mockedStoreName = 'Mercado Store';
    mockedSignOut.mockClear();
    mockedShowLogin.mockClear();
    mockedShowSignUp.mockClear();
    mockedFetchMyProfile.mockReset();
    mockedUpdateMyProfile.mockReset();
    mockedClearMyProfileAvatar.mockReset();
    mockedUpdateMyStoreName.mockReset();
    mockedRefresh.mockClear();
    mockedGetSession.mockReset();
    mockedGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    });
    mockedFetchMyProfile.mockResolvedValue({
      id: 'profile-1',
      email: 'ana@example.com',
      fullName: 'Ana Mercado',
      avatarUrl: null,
    });
    mockedUpdateMyProfile.mockResolvedValue({
      id: 'profile-1',
      email: 'ana@example.com',
      fullName: 'Ana Mercado',
      avatarUrl: null,
    });
    mockedUpdateMyStoreName.mockResolvedValue({
      id: 'store-1',
      ownerId: 'profile-1',
      name: 'Mercado Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    mockedClearMyProfileAvatar.mockResolvedValue({
      id: 'profile-1',
      email: 'ana@example.com',
      fullName: 'Ana Mercado',
      avatarUrl: null,
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('shows authenticated profile details in read mode with edit action', async () => {
    const tree = await renderProfileScreen();

    expect(findTextNodes(tree, 'Ana Mercado')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'ana@example.com')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Mercado Store')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'AM')).not.toHaveLength(0);
    expect(findPressable(tree, 'Edit profile')).toBeDefined();
  });

  it('enters edit mode with current values prefilled', async () => {
    const tree = await renderProfileScreen();

    await act(async () => {
      findPressable(tree, 'Edit profile').props.onPress();
    });

    expect(findTextInputByValue(tree, 'Ana Mercado')).toBeDefined();
    expect(findTextInputByValue(tree, 'ana@example.com')).toBeDefined();
    expect(findTextInputByValue(tree, 'Mercado Store')).toBeDefined();
    expect(findPressable(tree, 'Save')).toBeDefined();
  });

  it('saves profile and store changes then exits edit mode', async () => {
    const tree = await renderProfileScreen();

    mockedUpdateMyProfile.mockResolvedValue({
      id: 'profile-1',
      email: 'ana@example.com',
      fullName: 'Ana M',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });
    mockedUpdateMyStoreName.mockResolvedValue({
      id: 'store-1',
      ownerId: 'profile-1',
      name: 'Ana Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    await act(async () => {
      findPressable(tree, 'Edit profile').props.onPress();
    });

    await act(async () => {
      findTextInputByValue(tree, 'Ana Mercado').props.onChangeText('Ana M');
      findTextInputByValue(tree, 'Mercado Store').props.onChangeText('Ana Store');
    });

    await act(async () => {
      await findPressable(tree, 'Save').props.onPress();
    });

    expect(mockedUpdateMyProfile).toHaveBeenCalledWith('session-token', {
      fullName: 'Ana M',
      avatarUrl: '',
    });
    expect(mockedUpdateMyStoreName).toHaveBeenCalledWith('session-token', 'Ana Store');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(findTextNodes(tree, 'Save')).toHaveLength(0);
    expect(findPressable(tree, 'Edit profile')).toBeDefined();
    expect(findImages(tree)).toHaveLength(1);
  });

  it('removes avatar and falls back to initials', async () => {
    mockedFetchMyProfile.mockResolvedValue({
      id: 'profile-1',
      email: 'ana@example.com',
      fullName: 'Ana Mercado',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });

    const tree = await renderProfileScreen();

    await act(async () => {
      findPressable(tree, 'Edit profile').props.onPress();
    });

    await act(async () => {
      await findPressable(tree, 'Remove avatar').props.onPress();
    });

    expect(mockedClearMyProfileAvatar).toHaveBeenCalledWith('session-token');
    expect(findImages(tree)).toHaveLength(0);
    expect(findTextNodes(tree, 'AM')).not.toHaveLength(0);
  });

  it('keeps edit mode open when store save fails', async () => {
    mockedUpdateMyStoreName.mockRejectedValue(new Error('Store update failed.'));

    const tree = await renderProfileScreen();

    await act(async () => {
      findPressable(tree, 'Edit profile').props.onPress();
    });

    await act(async () => {
      await findPressable(tree, 'Save').props.onPress();
    });

    expect(findTextNodes(tree, 'Store update failed.')).not.toHaveLength(0);
    expect(findPressable(tree, 'Save')).toBeDefined();
  });

  it('renders auth actions when signed out', async () => {
    mockedIsAuthenticated = false;
    mockedStoreName = null;

    const tree = await renderProfileScreen();

    expect(findTextNodes(tree, 'Log in')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Create account')).not.toHaveLength(0);
    expect(findTextNodes(tree, 'Edit profile')).toHaveLength(0);
  });
});
