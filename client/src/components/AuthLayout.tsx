import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/navigation/colors';

type AuthLayoutProps = {
  badge: string;
  logoSource?: ImageSourcePropType;
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
  logoSource,
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
    <LinearGradient colors={[colors.background, '#F8F1DA', '#EDE2BD']} style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <SafeAreaView style={styles.safeArea}>
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
              <View style={styles.cardTopRow}>
                <View style={styles.brandCluster}>
                  {logoSource ? (
                    <Image
                      source={logoSource}
                      resizeMode="contain"
                      style={styles.brandLogo}
                    />
                  ) : null}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                </View>
                {dismissLabel && onDismiss ? (
                  <Pressable onPress={onDismiss} style={styles.dismissButton}>
                    <Text style={styles.dismissText}>{dismissLabel}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.copyBlock}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              <View style={styles.form}>{children}</View>

              <View style={styles.actions}>
                {submitLabel && onSubmit ? (
                  <PrimaryButton label={loading ? 'Please wait...' : submitLabel} onPress={handleSubmit} />
                ) : null}
                {alternateLabel && onAlternatePress ? (
                  <Pressable onPress={onAlternatePress} style={styles.linkButton}>
                    <Text style={styles.linkText}>{alternateLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 18,
  },
  glowTop: {
    position: 'absolute',
    top: -72,
    right: -24,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: 'rgba(31, 122, 99, 0.14)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -110,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: 'rgba(242, 201, 76, 0.16)',
  },
  card: {
    gap: 22,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 253, 245, 0.92)',
    padding: 26,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  brandCluster: {
    gap: 10,
    alignItems: 'flex-start',
  },
  brandLogo: {
    width: 112,
    height: 34,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  dismissButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dismissText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  badgeText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  copyBlock: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
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
    minHeight: 48,
  },
  linkText: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '700',
  },
});
