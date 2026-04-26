import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;
let App: typeof import('./App').default;
let mockFontsLoaded = false;
let mockFontError: Error | null = null;

vi.mock('react-native-gesture-handler', () => ({}));

vi.mock('@expo/vector-icons', () => ({
  Feather: { font: { Feather: 'feather-font.ttf' } },
  FontAwesome: { font: { FontAwesome: 'fontawesome-font.ttf' } },
  Ionicons: { font: { Ionicons: 'ionicons-font.ttf' } },
}));

vi.mock('expo-font', () => ({
  useFonts: () => [mockFontsLoaded, mockFontError],
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/features/local-data/LocalDataContext', () => ({
  LocalDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/navigation/RootNavigator', () => ({
  RootNavigator: () => null,
}));

vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => (
    <navigation-container>{children}</navigation-container>
  ),
}));

describe('App', () => {
  beforeEach(async () => {
    App = (await import('./App')).default;
    mockFontsLoaded = false;
    mockFontError = null;
  });

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('react-test-renderer is deprecated')) {
        return;
      }

      originalConsoleError(message, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('waits for icon fonts before rendering the navigation tree', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<App />);
    });

    expect(tree.toJSON()).toBeNull();
  });

  it('wraps the navigation tree in a navigation container after fonts load', () => {
    mockFontsLoaded = true;

    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<App />);
    });

    expect(tree.toJSON()).toMatchObject({
      type: 'navigation-container',
    });
  });
});
