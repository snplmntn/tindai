import { StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

const authErrorColor = '#BA1A1A';

export function LoginScreen() {
  const { showSignUp, signInWithGoogle, authError } = useAuth();

  return (
    <AuthLayout
      badge="Client Access"
      title="Welcome back"
      subtitle="Use Google to open the client workspace, check the dashboard, and stay on top of inventory and analytics."
      submitLabel="Continue with Google"
      alternateLabel="Need an account? Create one"
      onSubmit={signInWithGoogle}
      onAlternatePress={showSignUp}
    >
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>Google OAuth is required for this MVP auth flow.</Text>
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  infoBlock: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.68)',
    padding: 14,
  },
  infoText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: authErrorColor,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});

