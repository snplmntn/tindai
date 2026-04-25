import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/navigation/colors';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  submitLabel?: string;
  alternateLabel?: string;
  onSubmit?: () => Promise<void> | void;
  onAlternatePress?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  submitButtonStyle?: ViewStyle;
  children: ReactNode;
};

export function AuthLayout({
  title,
  subtitle,
  submitLabel,
  alternateLabel,
  onSubmit,
  onAlternatePress,
  dismissLabel,
  onDismiss,
  submitButtonStyle,
  children,
}: AuthLayoutProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!onSubmit) {
      return;
    }

    setLoading(true);

    try {
      await onSubmit();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.headerBlock}>
              <View style={styles.headerRow}>
                {dismissLabel && onDismiss ? (
                  <Pressable onPress={onDismiss} style={styles.headerActionButton}>
                    <Text style={styles.headerActionText}>{dismissLabel}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.copyBlock}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.form}>{children}</View>

              <View style={styles.actions}>
                {submitLabel && onSubmit ? (
                  <PrimaryButton
                    label={loading ? 'Sandali lang...' : submitLabel}
                    onPress={handleSubmit}
                    buttonStyle={submitButtonStyle}
                  />
                ) : null}
                {alternateLabel && onAlternatePress ? (
                  <Pressable onPress={onAlternatePress} style={styles.linkButton}>
                    <Text style={styles.linkText}>{alternateLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 22,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 24,
  },
  headerBlock: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerActionButton: {
    minHeight: 30,
    justifyContent: 'center',
  },
  copyBlock: {
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  formSection: {
    gap: 18,
  },
  form: {
    gap: 14,
  },
  actions: {
    gap: 10,
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerActionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
