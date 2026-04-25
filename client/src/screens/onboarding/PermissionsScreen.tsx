import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mobileCopy } from '@/copy/mobileCopy';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

type PermissionStatus = 'pending' | 'granted' | 'denied';

function statusLabel(status: PermissionStatus) {
  if (status === 'granted') {
    return 'Pinayagan';
  }

  if (status === 'denied') {
    return 'Hindi pinayagan';
  }

  return 'Hindi pa nasisimulan';
}

function PermissionCard({
  icon,
  title,
  badge,
  body,
  status,
  required = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  badge: string;
  body: string;
  status: PermissionStatus;
  required?: boolean;
}) {
  const granted = status === 'granted';

  return (
    <View style={[styles.permissionCard, required && styles.permissionCardRequired]}>
      <View style={[styles.permissionIcon, required ? styles.permissionIconRequired : undefined]}>
        <Ionicons name={icon} size={26} color={required ? '#b1ffe4' : colors.muted} />
      </View>
      <View style={styles.permissionBody}>
        <View style={styles.permissionTitleRow}>
          <Text style={styles.permissionTitle}>{title}</Text>
          <Text style={[styles.permissionBadge, required ? styles.permissionBadgeRequired : undefined]}>{badge}</Text>
        </View>
        <Text style={styles.permissionText}>{body}</Text>
        <Text style={[styles.permissionStatus, granted ? styles.permissionStatusGranted : undefined]}>
          {statusLabel(status)}
        </Text>
      </View>
      <Ionicons
        name={granted ? 'checkmark-circle' : 'ellipse-outline'}
        size={28}
        color={granted ? colors.primary : '#bec9c3'}
      />
    </View>
  );
}

export function PermissionsScreen() {
  const {
    microphonePermission,
    storagePermission,
    requestMicrophonePermission,
    requestStoragePermission,
    completeOnboarding,
  } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleContinue = async () => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const microphone = await requestMicrophonePermission();
      await requestStoragePermission();

      if (microphone === 'denied') {
        setMessage('Pwede ka pa ring magpatuloy. I-tap lang ang mic mamaya kung gusto mong i-enable ulit.');
      }

      await completeOnboarding();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Hindi makuha ang permission. Subukan ulit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <Text style={styles.topBarTitle}>{mobileCopy.onboardingTopBarTitle}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progressBlock}>
          <Text style={styles.progressLabel}>Hakbang 3 ng 4</Text>
          <View style={styles.segmentTrack}>
            <View style={styles.segmentActive} />
            <View style={styles.segmentActive} />
            <View style={styles.segmentActive} />
            <View style={styles.segmentInactive} />
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>Kailangan namin ng kaunting pahintulot.</Text>
          <Text style={styles.subtitle}>
            Upang magamit ang voice inventory nang maayos, kailangan ng app ng access sa iyong mikropono at device storage.
          </Text>
        </View>

        <View style={styles.permissionsList}>
          <PermissionCard
            icon="mic"
            title="Mikropono"
            badge="Kailangan"
            body="Para makapag-record ng inventory data gamit ang iyong boses."
            status={microphonePermission}
            required
          />
          <PermissionCard
            icon="folder-outline"
            title="Storage"
            badge="Opsyonal"
            body="Para ma-save ang mga backup ng iyong inventory offline sa device."
            status={storagePermission}
          />
        </View>

        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={19} color={colors.muted} />
          <Text style={styles.privacyText}>
            Ginagamit lang ang pahintulot na ito para mapagana ang app at panatilihing ligtas ang tindahan mo.
          </Text>
        </View>

        <Pressable
          onPress={() => void handleContinue()}
          disabled={isSubmitting}
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Sandali lang...' : 'Payagan at Magpatuloy'}</Text>
          {isSubmitting ? <ActivityIndicator color={colors.surface} size="small" /> : <Ionicons name="arrow-forward" size={18} color={colors.surface} />}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 26,
  },
  progressBlock: {
    gap: 12,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 6,
    height: 8,
  },
  segmentActive: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  segmentInactive: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#e0e3e0',
  },
  copyBlock: {
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 27,
  },
  permissionsList: {
    gap: 14,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#bec9c3',
    backgroundColor: colors.surface,
    padding: 16,
  },
  permissionCardRequired: {
    borderColor: colors.primary,
    backgroundColor: '#eff4ff',
  },
  permissionIcon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebefeb',
  },
  permissionIconRequired: {
    backgroundColor: colors.primary,
  },
  permissionBody: {
    flex: 1,
    gap: 6,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  permissionBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#e0e3e0',
    color: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  permissionBadgeRequired: {
    backgroundColor: '#b1ffe4',
    color: colors.primaryDeep,
  },
  permissionText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  permissionStatus: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  permissionStatusGranted: {
    color: colors.primary,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
  },
  privacyText: {
    flex: 1,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
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
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
