import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';

function PermissionRow({
  title,
  body,
  status,
}: {
  title: string;
  body: string;
  status: 'pending' | 'granted' | 'denied';
}) {
  const statusLabel =
    status === 'granted' ? 'Pinayagan' : status === 'denied' ? 'Hindi pinayagan' : 'Hindi pa nasisimulan';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.statusPill, status === 'granted' ? styles.statusGranted : status === 'denied' ? styles.statusDenied : undefined]}>
          {statusLabel}
        </Text>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
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
    <AuthLayout
      badge="Permissions"
      logoSource={require('../../assets/tindai-logo.png')}
      title="Kailangan muna ng pahintulot"
      subtitle="Papayagan ka pa ring makapasok agad sa dashboard. Kapag hindi pinayagan ang mic, pwede mo itong buksan mamaya."
    >
      <PermissionRow
        title="Microphone"
        body="Kailangan ng Tindai ang access sa iyong microphone upang makinig sa iyong mga utos."
        status={microphonePermission}
      />
      <PermissionRow
        title="Storage"
        body="Gagamitin ng Tindai ang storage ng phone para manatili ang iyong mga tala sa device."
        status={storagePermission}
      />

      <PrimaryButton label={isSubmitting ? 'Sandali lang...' : 'Magpatuloy'} onPress={() => void handleContinue()} />

      {isSubmitting ? <ActivityIndicator color="#1f7a63" size="small" /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dfded7',
    backgroundColor: '#fffdf5',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    color: '#171c19',
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    color: '#56625c',
    fontSize: 14,
    lineHeight: 21,
  },
  statusPill: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#f0ede2',
    color: '#45534d',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
  },
  statusGranted: {
    backgroundColor: '#def4eb',
    color: '#0a684d',
  },
  statusDenied: {
    backgroundColor: '#ffddd9',
    color: '#9b1c12',
  },
  message: {
    color: '#56625c',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
