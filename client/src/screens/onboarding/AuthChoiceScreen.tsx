import { StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';

export function AuthChoiceScreen() {
  const { chooseGuestMode, showLogin } = useAuth();

  return (
    <AuthLayout
      badge="Tindai"
      logoSource={require('../../assets/tindai-logo.png')}
      title="Simulan ang Tindai"
      subtitle="Voice-first na inventory para sa iyong sari-sari store."
    >
      <View style={styles.actionGroup}>
        <PrimaryButton label="Mag-sign In o Mag-sign Up" onPress={() => void showLogin()} />
        <PrimaryButton label="Simulan bilang Guest" onPress={() => void chooseGuestMode()} variant="ghost" />
      </View>
      <Text style={styles.disclaimer}>Ang guest data ay lilipat kung mag-sign up ka mamaya.</Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  actionGroup: {
    gap: 12,
  },
  disclaimer: {
    color: '#56625c',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
