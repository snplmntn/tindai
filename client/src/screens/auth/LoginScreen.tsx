import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthField } from '@/components/AuthField';
import { AuthLayout } from '@/components/AuthLayout';
import { GoogleSignInMark } from '@/components/GoogleSignInMark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

const authErrorColor = '#BA1A1A';

export function LoginScreen() {
  const {
    showSignUp,
    closeAuth,
    signInWithGoogle,
    signInWithEmail,
    authError,
    clearAuthError,
    googleSignInHint,
    isGoogleSignInEnabled,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const fieldErrors = useMemo(
    () => ({
      email: attemptedSubmit && !email.trim(),
      password: attemptedSubmit && !password,
    }),
    [attemptedSubmit, email, password],
  );

  const handleEmailSignIn = async () => {
    setAttemptedSubmit(true);
    if (!email.trim() || !password) {
      return;
    }

    await signInWithEmail({
      email,
      password,
    });
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleSignInEnabled || isGoogleSubmitting) {
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <AuthLayout
      badge="Backup ng account"
      title="Mag-sign in sa account mo."
      subtitle="I-save ang imbentaryo mo online para may backup ka kapag nawala ang internet o nagpalit ka ng phone."
      submitLabel="Magpatuloy"
      alternateLabel="Wala ka pang account? Gumawa ka rito."
      onSubmit={handleEmailSignIn}
      onAlternatePress={() => void showSignUp()}
      dismissLabel="Bumalik sa app"
      onDismiss={() => void closeAuth()}
    >
      <View style={styles.formBlock}>
        <AuthField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearAuthError();
          }}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          hasError={fieldErrors.email}
        />
        <AuthField
          label="Password"
          placeholder="Ilagay ang password mo"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearAuthError();
          }}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          hasError={fieldErrors.password}
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o</Text>
        <View style={styles.dividerLine} />
      </View>

      <PrimaryButton
        label={isGoogleSubmitting ? 'Nag-sign in gamit ang Google...' : 'Mag-sign in gamit ang Google'}
        onPress={handleGoogleSignIn}
        variant="ghost"
        leadingIcon={<GoogleSignInMark />}
        disabled={!isGoogleSignInEnabled || isGoogleSubmitting}
      />

      {googleSignInHint ? <Text style={styles.infoText}>{googleSignInHint}</Text> : null}

      {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  formBlock: {
    gap: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: authErrorColor,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});
