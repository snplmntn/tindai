import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLocalData } from '@/features/local-data/LocalDataContext';
import { fetchMyProfile, type RemoteProfile } from '@/features/profile/profileApi';
import { colors } from '@/navigation/colors';

function getDisplayName(profile: RemoteProfile | null) {
  return profile?.fullName?.trim() || 'Store owner';
}

function getDisplayEmail(profile: RemoteProfile | null) {
  return profile?.email?.trim() || 'No email available';
}

function getDisplayStore(storeName: string | undefined) {
  return storeName?.trim() || 'No store connected';
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { isAuthenticated, signOut, showLogin, showSignUp } = useAuth();
  const { store } = useLocalData();
  const [profile, setProfile] = useState<RemoteProfile | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!isAuthenticated) {
        if (isActive) {
          setProfile(null);
        }
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (!accessToken) {
          if (isActive) {
            setProfile(null);
          }
          return;
        }

        const nextProfile = await fetchMyProfile(accessToken);
        if (isActive) {
          setProfile(nextProfile);
        }
      } catch {
        if (isActive) {
          setProfile(null);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  const displayName = getDisplayName(profile);
  const displayEmail = getDisplayEmail(profile);
  const displayStore = getDisplayStore(store?.name);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.contentContainer} style={styles.screen}>
        <View style={styles.headerBlock}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>View the essential account and store details for this workspace.</Text>
        </View>

        <View style={styles.card}>
          <SummaryRow label="Name" value={displayName} />
          <SummaryRow label="Email" value={displayEmail} />
          <SummaryRow label="Store" value={displayStore} />
        </View>

        {isAuthenticated ? (
          <View style={styles.actionSection}>
            <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
              <Text style={styles.secondaryButtonLabel}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.ctaTitle}>Connect an account</Text>
            <Text style={styles.ctaBody}>Log in or create an account when you want this device to sync with your store online.</Text>
            <View style={styles.ctaActions}>
              <Pressable style={styles.secondaryButton} onPress={showLogin}>
                <Text style={styles.secondaryButtonLabel}>Log in</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={showSignUp}>
                <Text style={styles.primaryButtonLabel}>Create account</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  headerBlock: {
    gap: 6,
    paddingVertical: 8,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    gap: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  summaryRow: {
    gap: 6,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  actionSection: {
    paddingTop: 4,
  },
  ctaTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  ctaBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  ctaActions: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDeep,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
