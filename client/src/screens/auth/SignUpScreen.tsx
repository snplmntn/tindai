import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthField } from '@/components/AuthField';
import { AuthLayout } from '@/components/AuthLayout';
import { GoogleSignInMark } from '@/components/GoogleSignInMark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

const authErrorColor = '#BA1A1A';
const MIN_PASSWORD_LENGTH = 8;

export function SignUpScreen() {
  const {
    showLogin,
    closeAuth,
    signInWithGoogle,
    signUpWithEmail,
    authError,
    clearAuthError,
    googleSignInHint,
    isGoogleSignInEnabled,
  } = useAuth();
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fieldErrors = useMemo(
    () => ({
      fullName: attemptedSubmit && !fullName.trim(),
      storeName: attemptedSubmit && !storeName.trim(),
      email: attemptedSubmit && !email.trim(),
      password: attemptedSubmit && password.length < MIN_PASSWORD_LENGTH,
      confirmPassword: attemptedSubmit && confirmPassword !== password,
    }),
    [attemptedSubmit, confirmPassword, email, fullName, password, storeName],
  );

  const handleEmailSignUp = async () => {
    setAttemptedSubmit(true);
    setLocalError(null);

    if (!fullName.trim() || !storeName.trim() || !email.trim() || password.length < MIN_PASSWORD_LENGTH || confirmPassword !== password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setLocalError('Dapat hindi bababa sa 8 character ang password.');
      } else if (confirmPassword !== password) {
        setLocalError('Hindi magkapareho ang password.');
      }
      return;
    }

    await signUpWithEmail({
      fullName,
      storeName,
      email,
      password,
    });
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleSignInEnabled || isGoogleSubmitting) {
      return;
    }

    setLocalError(null);
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
      title="Gumawa ng account."
      subtitle="Gumawa ng account para ma-save online ang tala ng tindahan mo at madali mo itong maibalik kapag nagpalit ka ng phone."
      submitLabel="Gumawa ng Account"
      alternateLabel="May account ka na? Mag-sign in"
      onSubmit={handleEmailSignUp}
      onAlternatePress={() => void showLogin()}
      dismissLabel="Bumalik sa app"
      onDismiss={() => void closeAuth()}
    >
      <View style={styles.formBlock}>
        <AuthField
          label="Buong pangalan"
          placeholder="Juan Dela Cruz"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            setLocalError(null);
            clearAuthError();
          }}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          hasError={fieldErrors.fullName}
        />
        <AuthField
          label="Pangalan ng tindahan"
          placeholder="Nena Sari-Sari Store"
          value={storeName}
          onChangeText={(value) => {
            setStoreName(value);
            setLocalError(null);
            clearAuthError();
          }}
          autoCapitalize="words"
          hasError={fieldErrors.storeName}
        />
        <AuthField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setLocalError(null);
            clearAuthError();
          }}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          hasError={fieldErrors.email}
        />
        <AuthField
          label="Password"
          placeholder="Hindi bababa sa 8 character"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setLocalError(null);
            clearAuthError();
          }}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hasError={fieldErrors.password}
        />
        <AuthField
          label="Ulitin ang password"
          placeholder="I-type ulit ang password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setLocalError(null);
            clearAuthError();
          }}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hasError={fieldErrors.confirmPassword}
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o</Text>
        <View style={styles.dividerLine} />
      </View>

      <PrimaryButton
        label={isGoogleSubmitting ? 'Gumagawa ng account gamit ang Google...' : 'Gumawa ng account gamit ang Google'}
        onPress={handleGoogleSignIn}
        variant="ghost"
        leadingIcon={<GoogleSignInMark />}
        disabled={!isGoogleSignInEnabled || isGoogleSubmitting}
      />

      {googleSignInHint ? <Text style={styles.infoText}>{googleSignInHint}</Text> : null}

      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
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
