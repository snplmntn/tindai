import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';
import { HomeTabs } from '@/screens/HomeTabs';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { OnboardingOverlay } from '@/screens/onboarding/OnboardingOverlay';

export function RootNavigator() {
  const { activeRoute, hasCompletedOnboarding, onboardingStep, isAuthLoading, nextOnboardingStep, skipOnboarding } = useAuth();

  if (isAuthLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primaryDeep} size="large" />
      </View>
    );
  }

  if (activeRoute.kind === 'auth') {
    return activeRoute.screen === 'login' ? <LoginScreen /> : <SignUpScreen />;
  }

  return (
    <View style={styles.tabsRoot}>
      <HomeTabs />
      {!hasCompletedOnboarding ? (
        <OnboardingOverlay step={onboardingStep} onNext={nextOnboardingStep} onSkip={skipOnboarding} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  tabsRoot: {
    flex: 1,
  },
});

