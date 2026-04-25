import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

const valueProps = [
  'I-track ang benta gamit ang boses mo',
  'Gumagana kahit walang internet',
  'Makikita agad ang malapit nang maubos',
];

function SetupProgress() {
  return (
    <View style={styles.progressBlock}>
      <Text style={styles.progressLabel}>Hakbang 1 ng 4</Text>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>
    </View>
  );
}

export function AuthChoiceScreen() {
  const { chooseGuestMode, showLogin } = useAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <Text style={styles.topBarTitle}>Setup Progress</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SetupProgress />

        <View style={styles.brandBlock}>
          <View style={styles.brandIcon}>
            <Ionicons name="mic" size={38} color="#b1ffe4" />
          </View>
          <Text style={styles.brandTitle}>Tindai</Text>
          <Text style={styles.brandSubtitle}>Boses-una na inventory para sa tindahan mo.</Text>
        </View>

        <View style={styles.valueList}>
          {valueProps.map((point) => (
            <View key={point} style={styles.valueRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={styles.valueText}>{point}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Mag-sign In o Gumawa ng Account" onPress={() => void showLogin()} />
          <PrimaryButton label="Simulan bilang Guest" onPress={() => void chooseGuestMode()} variant="ghost" />
        </View>

        <Text style={styles.disclaimer}>
          Sa pagpapatuloy, sumasang-ayon ka sa aming Terms of Service at Privacy Policy.
        </Text>
      </ScrollView>
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
  topBarSpacer: {
    width: 40,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
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
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e0e3e0',
    overflow: 'hidden',
  },
  progressFill: {
    width: '25%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 12,
  },
  brandIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  brandTitle: {
    color: colors.primary,
    fontSize: 46,
    fontWeight: '800',
    lineHeight: 54,
  },
  brandSubtitle: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 27,
    maxWidth: 300,
    textAlign: 'center',
  },
  valueList: {
    gap: 10,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  valueText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  disclaimer: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
