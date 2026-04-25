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
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <AuthLayout
      badge="Account backup"
      title="Ikonekta ang account mo."
      subtitle="I-save ang iyong imbentaryo at i-sync sa cloud para sa ligtas na backup."
      submitLabel="Magpatuloy"
      alternateLabel="Wala ka pang account? Gumawa dito."
      onSubmit={handleEmailSignIn}
      onAlternatePress={() => void showSignUp()}
      dismissLabel="Back to app"
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
          placeholder="Enter your password"
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
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <PrimaryButton
        label={isGoogleSubmitting ? 'Nag-sign in gamit ang Google...' : 'Mag-sign in gamit ang Google'}
        onPress={handleGoogleSignIn}
        variant="ghost"
        leadingIcon={<GoogleSignInMark />}
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
