import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';
import { HomeTabs } from '@/screens/HomeTabs';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { OnboardingAnalyticsScreen } from '@/screens/onboarding/OnboardingAnalyticsScreen';
import { OnboardingDashboardScreen } from '@/screens/onboarding/OnboardingDashboardScreen';
import { OnboardingInventoryScreen } from '@/screens/onboarding/OnboardingInventoryScreen';

export function RootNavigator() {
  const { activeRoute, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primaryDeep} size="large" />
      </View>
    );
  }

  if (activeRoute.kind === 'onboarding') {
    if (activeRoute.step === 1) {
      return <OnboardingInventoryScreen />;
    }

    if (activeRoute.step === 2) {
      return <OnboardingDashboardScreen />;
    }

    return <OnboardingAnalyticsScreen />;
  }

  if (activeRoute.kind === 'auth') {
    return activeRoute.screen === 'login' ? <LoginScreen /> : <SignUpScreen />;
  }

  return <HomeTabs />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});

