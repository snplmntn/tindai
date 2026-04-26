import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthField } from '@/components/AuthField';
import { AuthLayout } from '@/components/AuthLayout';
import { mobileCopy } from '@/copy/mobileCopy';
import { useAuth } from '@/context/AuthContext';

const authErrorColor = '#BA1A1A';

export function LoginScreen() {
  const {
    showSignUp,
    closeAuth,
    signInWithEmail,
    authError,
    clearAuthError,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

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

  return (
    <AuthLayout
      topBarTitle={mobileCopy.onboardingTopBarTitle}
      progressLabel="Hakbang 2 ng 4"
      progressValue="50%"
      title="Ikonekta ang account mo."
      subtitle="I-save ang iyong imbentaryo at i-sync sa cloud para sa ligtas na backup."
      submitLabel="Magpatuloy"
      submitButtonStyle={styles.authButton}
      alternateLabel="Wala ka pang account? Gumawa dito."
      onSubmit={handleEmailSignIn}
      onAlternatePress={() => void showSignUp()}
      dismissLabel={mobileCopy.backToApp}
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
          placeholder="Ilagay ang password"
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

      {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  formBlock: {
    gap: 10,
  },
  authButton: {
    borderRadius: 12,
    minHeight: 52,
  },
  errorText: {
    color: authErrorColor,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});
