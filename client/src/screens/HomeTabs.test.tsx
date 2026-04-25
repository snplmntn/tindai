import { describe, expect, it, vi } from 'vitest';

import { colors } from '@/navigation/colors';

const { mockCreateBottomTabNavigator } = vi.hoisted(() => ({
  mockCreateBottomTabNavigator: vi.fn(() => ({
    Navigator: 'mock-navigator',
    Screen: 'mock-screen',
  })),
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: mockCreateBottomTabNavigator,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  View: 'mock-view',
}));

vi.mock('@/screens/tabs/AnalyticsScreen', () => ({
  AnalyticsScreen: () => null,
}));

vi.mock('@/screens/tabs/DashboardScreen', () => ({
  DashboardScreen: () => null,
}));

vi.mock('@/screens/tabs/InventoryScreen', () => ({
  InventoryScreen: () => null,
}));

vi.mock('@/screens/tabs/UtangScreen', () => ({
  UtangScreen: () => null,
}));

vi.mock('@/screens/tabs/ProfileScreen', () => ({
  ProfileScreen: () => null,
}));

import { HomeTabs } from '@/screens/HomeTabs';

describe('HomeTabs', () => {
  it('opens dashboard as initial tab', () => {
    const element = HomeTabs();
    expect(element.props.initialRouteName).toBe('Dashboard');
  });

  it('disables the top app bar for tab screens', () => {
    const element = HomeTabs();
    const options = element.props.screenOptions({
      route: { name: 'Inventory' },
    });

    expect(options.headerShown).toBe(false);
  });

  it('places Utang to the left of Dashboard in the bottom tab order', () => {
    const element = HomeTabs();
    const screens = element.props.children;
    const screenNames = screens.map((screen: { props: { name: string } }) => screen.props.name);

    expect(screenNames).toEqual(['Inventory', 'Utang', 'Dashboard', 'Analytics', 'Profile']);
  });

  it('uses a white tab shell with green active states', () => {
    const element = HomeTabs();
    const options = element.props.screenOptions({
      route: { name: 'Dashboard' },
    });

    expect(options.tabBarStyle.backgroundColor).toBe(colors.surface);
    expect(options.tabBarStyle.borderTopColor).toBe(colors.border);
    expect(options.tabBarActiveTintColor).toBe(colors.primaryDeep);
    expect(options.tabBarInactiveTintColor).toBe(colors.muted);
  });
});
