import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/navigation/colors';
import { AnalyticsScreen } from '@/screens/tabs/AnalyticsScreen';
import { DashboardScreen } from '@/screens/tabs/DashboardScreen';
import { InventoryScreen } from '@/screens/tabs/InventoryScreen';
import { ProfileScreen } from '@/screens/tabs/ProfileScreen';

const Tab = createBottomTabNavigator();

export function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingHorizontal: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingVertical: 3,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconName =
            route.name === 'Inventory'
              ? 'cube-outline'
              : route.name === 'Dashboard'
                ? focused
                  ? 'mic'
                  : 'mic-outline'
                : route.name === 'Analytics'
                  ? 'bar-chart-outline'
                  : 'person-outline';

          const isDashboard = route.name === 'Dashboard';
          const isActive = focused;

          return (
            <View
              style={[
                styles.iconWrap,
                isDashboard ? styles.dashboardIconWrap : undefined,
                isActive ? styles.iconWrapActive : undefined,
                isDashboard && isActive ? styles.dashboardIconWrapActive : undefined,
              ]}
            >
              <Ionicons
                name={iconName}
                size={isDashboard ? size + 1 : size}
                color={isDashboard && isActive ? colors.surface : isActive ? colors.primaryDeep : color}
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(31, 122, 99, 0.1)',
  },
  dashboardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  dashboardIconWrapActive: {
    backgroundColor: colors.primaryDeep,
  },
});
