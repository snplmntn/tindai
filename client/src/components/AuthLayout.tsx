import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/navigation/colors';

type AuthLayoutProps = {
  badge: string;
  title: string;
  subtitle: string;
  submitLabel?: string;
  alternateLabel?: string;
  onSubmit?: () => Promise<void> | void;
  onAlternatePress?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  children: ReactNode;
};

export function AuthLayout({
  badge,
  title,
  subtitle,
  submitLabel,
  alternateLabel,
  onSubmit,
  onAlternatePress,
  dismissLabel,
  onDismiss,
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
      <View style={styles.topBar}>
        {onDismiss ? (
          <Pressable onPress={onDismiss} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.topBarTitle}>Pagsisimula</Text>
        <View style={styles.backButton} />
      </View>

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
          <View style={styles.card}>
            <View style={styles.progressBlock}>
              <Text style={styles.progressLabel}>Hakbang 2 ng 4</Text>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>

            <View style={styles.form}>{children}</View>

            <View style={styles.actions}>
              {submitLabel && onSubmit ? (
                <PrimaryButton label={loading ? 'Sandali lang...' : submitLabel} onPress={handleSubmit} />
              ) : null}
              {alternateLabel && onAlternatePress ? (
                <Pressable onPress={onAlternatePress} style={styles.linkButton}>
                  <Text style={styles.linkText}>{alternateLabel}</Text>
                </Pressable>
              ) : null}
              {dismissLabel && onDismiss ? (
                <Pressable onPress={onDismiss} style={styles.dismissButton}>
                  <Text style={styles.dismissText}>{dismissLabel}</Text>
                </Pressable>
              ) : null}
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
    backgroundColor: '#f7faf7',
  },
  topBar: {
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1ee',
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    color: colors.primaryDeep,
    fontSize: 18,
    fontWeight: '800',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.primaryDeep,
    fontSize: 34,
    fontWeight: '500',
    lineHeight: 36,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    gap: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f4f1',
    backgroundColor: colors.surface,
    padding: 24,
  },
  progressBlock: {
    gap: 10,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e0e3e0',
    overflow: 'hidden',
  },
  progressFill: {
    width: '50%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  copyBlock: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 39,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#e8f2f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  form: {
    gap: 16,
  },
  actions: {
    gap: 12,
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
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  dismissText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
