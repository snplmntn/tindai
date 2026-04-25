import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/navigation/colors';

type OnboardingOverlayProps = {
  onDismiss: () => void;
};

const howItWorks = [
  'Pindutin ang malaking mic button sa ibaba ng screen.',
  'Sabihin kung ano ang naibenta o naidagdag na stock nang natural.',
  'Kusa nang ma-uupdate ang iyong inventory at benta.',
];

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View style={styles.backdrop} />
      <View style={styles.card}>
        <View style={styles.progressBlock}>
          <Text style={styles.progressLabel}>Hakbang 4 ng 4</Text>
          <View style={styles.segmentTrack}>
            {[1, 2, 3, 4].map((value) => (
              <View key={value} style={styles.segmentActive} />
            ))}
          </View>
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.micHalo}>
            <Ionicons name="mic" size={44} color={colors.primary} />
          </View>
          <Text style={styles.title}>Handa ka na!</Text>
          <Text style={styles.body}>Maaari mo nang simulan ang pag-inventory gamit ang iyong boses.</Text>
        </View>

        <View style={styles.steps}>
          {howItWorks.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleLabel}>Halimbawa</Text>
          <Text style={styles.exampleText}>"Nakabenta ako ng tatlong Lucky Me at isang Coke Mismo."</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={onDismiss}>
          <Text style={styles.primaryLabel}>Simulan na ang Tindahan</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.surface} />
        </Pressable>
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
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#e0e3e0',
    padding: 22,
    gap: 20,
  },
  progressBlock: {
    gap: 10,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 7,
    height: 5,
  },
  segmentActive: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  heroBlock: {
    alignItems: 'center',
    gap: 10,
  },
  micHalo: {
    width: 94,
    height: 94,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f2f0',
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
  },
  steps: {
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff4ff',
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  exampleCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e3e0',
    backgroundColor: '#f8f9ff',
    padding: 16,
    gap: 8,
  },
  exampleLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  exampleText: {
    color: colors.primary,
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
  },
  primaryLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '800',
  },
});
