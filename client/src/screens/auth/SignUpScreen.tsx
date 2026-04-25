import { StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

const authErrorColor = '#BA1A1A';

export function SignUpScreen() {
  const { showLogin, signInWithGoogle, authError } = useAuth();

  return (
    <AuthLayout
      badge="Create Account"
      title="Set up your client access"
      subtitle="Use Google OAuth to create an account and continue directly into the client dashboard experience."
      submitLabel="Continue with Google"
      alternateLabel="Already have an account? Sign in"
      onSubmit={signInWithGoogle}
      onAlternatePress={showLogin}
    >
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>Account creation is handled by your Google sign-in.</Text>
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

