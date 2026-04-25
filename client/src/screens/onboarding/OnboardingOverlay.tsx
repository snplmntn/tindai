import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/navigation/colors';

type OnboardingOverlayProps = {
  step: 1 | 2 | 3;
  onNext: () => void;
  onSkip: () => void;
};

const STEP_COPY = {
  1: {
    title: 'Track inventory in one place',
    body: 'Use dashboard and inventory tabs immediately. You can keep working even without signing in first.',
    next: 'Next',
  },
  2: {
    title: 'Update stock with voice or text',
    body: 'Commands apply locally right away and stay available offline.',
    next: 'Next',
  },
  3: {
    title: 'Connect account when ready',
    body: 'Create an account from Profile to sync this device data to cloud.',
    next: 'Finish',
  },
} as const;

export function OnboardingOverlay({ step, onNext, onSkip }: OnboardingOverlayProps) {
  const content = STEP_COPY[step];

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View style={styles.backdrop} />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Quick Tour {step}/3</Text>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.body}>{content.body}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={onSkip}>
            <Text style={styles.secondaryLabel}>Skip</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryLabel}>{content.next}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  eyebrow: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryLabel: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
});
