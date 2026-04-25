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
          height: 76,
          paddingBottom: 12,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          paddingVertical: 4,
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

          return (
            <View
              style={[
                styles.iconWrap,
                isDashboard ? styles.dashboardIconWrap : undefined,
                color === colors.primaryDeep ? styles.iconWrapActive : undefined,
                isDashboard && color === colors.primaryDeep ? styles.dashboardIconWrapActive : undefined,
              ]}
            >
              <Ionicons
                name={iconName}
                size={isDashboard ? size + 2 : size}
                color={isDashboard && color === colors.primaryDeep ? colors.surface : color}
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.card,
  },
  dashboardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  dashboardIconWrapActive: {
    backgroundColor: colors.primaryDeep,
  },
});
