import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ClientTabLayout } from '@/components/ClientTabLayout';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/navigation/colors';

export function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <ClientTabLayout
      label="Profile"
      title="Manage the client account."
      subtitle="Keep account access, preferences, and session controls in one place without overloading the operational tabs."
      highlights={['Update account preferences', 'Review notification settings', 'Keep session access under control']}
    >
      <View style={styles.actionCard}>
        <Text style={styles.actionTitle}>Session</Text>
        <Text style={styles.actionBody}>Sign out returns the user to the login screen and keeps onboarding completed.</Text>

        <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </ClientTabLayout>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  actionBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  signOutButton: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 153, 74, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(242, 153, 74, 0.3)',
  },
  signOutText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});

