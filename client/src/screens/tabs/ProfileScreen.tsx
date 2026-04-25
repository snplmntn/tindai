import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLocalData } from '@/features/local-data/LocalDataContext';
import {
  clearMyProfileAvatar,
  fetchMyProfile,
  type RemoteProfile,
  updateMyProfile,
  updateMyStoreName,
} from '@/features/profile/profileApi';
import { colors } from '@/navigation/colors';

function getDisplayName(profile: RemoteProfile | null) {
  return profile?.fullName?.trim() || 'May-ari ng Tindahan';
}

function getDisplayEmail(profile: RemoteProfile | null) {
  return profile?.email?.trim() || 'Walang email';
}

function getDisplayStore(storeName: string | undefined) {
  return storeName?.trim() || 'My Store';
}

function getAvatarUrl(profile: RemoteProfile | null) {
  return profile?.avatarUrl?.trim() || null;
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'SO';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function getEditableStoreName(storeName: string | undefined) {
  return storeName?.trim() || '';
}

type SummaryRowProps = {
  label: string;
  value: string;
  isLast?: boolean;
};

function SummaryRow({ label, value, isLast = false }: SummaryRowProps) {
  return (
    <View style={[styles.summaryRow, !isLast && styles.summaryRowBorder]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueRow}>
        <Text style={styles.summaryValue} numberOfLines={2}>
          {value}
        </Text>
        <Text style={styles.summaryChevron}>›</Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { isAuthenticated, signOut, showLogin, showSignUp } = useAuth();
  const { store, refresh } = useLocalData();
  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullNameInput, setFullNameInput] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [storeNameInput, setStoreNameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  useEffect(() => {
    let isActive = true;

    const hydrateProfile = async () => {
      if (!isAuthenticated) {
        if (isActive) {
          setProfile(null);
          setIsEditing(false);
          setErrorMessage(null);
        }
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (isActive) {
          if (!accessToken) {
            setProfile(null);
            return;
          }

          const nextProfile = await fetchMyProfile(accessToken);
          setProfile(nextProfile);
        }
      } catch {
        if (isActive) {
          setProfile(null);
        }
      }
    };

    void hydrateProfile();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setFullNameInput(profile?.fullName?.trim() || '');
    setAvatarUrlInput(profile?.avatarUrl?.trim() || '');
  }, [isEditing, profile]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setStoreNameInput(getEditableStoreName(store?.name));
  }, [isEditing, store?.name]);

  const displayName = getDisplayName(profile);
  const displayEmail = getDisplayEmail(profile);
  const displayStore = getDisplayStore(store?.name);
  const avatarUrl = getAvatarUrl(profile);
  const avatarInitials = getInitials(displayName);
  const helperBody = isAuthenticated
    ? 'Handa ang detalye ng tindahan mo sa phone na ito.'
    : 'Mag-sign in para ma-backup ang tindahan mo online. Hindi mawawala ang data mo kahit offline.';

  const handleStartEdit = () => {
    setFullNameInput(profile?.fullName?.trim() || '');
    setAvatarUrlInput(profile?.avatarUrl?.trim() || '');
    setStoreNameInput(getEditableStoreName(store?.name));
    setErrorMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFullNameInput(profile?.fullName?.trim() || '');
    setAvatarUrlInput(profile?.avatarUrl?.trim() || '');
    setStoreNameInput(getEditableStoreName(store?.name));
    setErrorMessage(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    let accessToken: string | null = null;
    let didUpdateProfile = false;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;

      if (!accessToken) {
        throw new Error('Please log in again to continue.');
      }

      const nextProfile = await updateMyProfile(accessToken, {
        fullName: fullNameInput,
        avatarUrl: avatarUrlInput,
      });
      didUpdateProfile = true;
      setProfile(nextProfile);

      await updateMyStoreName(accessToken, storeNameInput);
      await refresh();
      setIsEditing(false);
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : 'Unable to save profile right now.');

      if (didUpdateProfile) {
        try {
          await refresh();
          if (accessToken) {
            const nextProfile = await fetchMyProfile(accessToken);
            setProfile(nextProfile);
          }
        } catch {
          // Keep the current local profile state when refresh is unavailable.
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsRemovingAvatar(true);
    setErrorMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error('Please log in again to continue.');
      }

      const nextProfile = await clearMyProfileAvatar(accessToken);
      setProfile(nextProfile);
      setAvatarUrlInput('');
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : 'Unable to remove avatar right now.');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.contentContainer} style={styles.screen}>
        <View style={styles.heroSection}>
          <View style={styles.heroPatternLarge} />
          <View style={styles.heroPatternSmall} />

          <View style={styles.heroContent}>
            <Text style={styles.heroPageTitle}>Profile</Text>

            <View style={styles.heroAvatarShell}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.heroAvatarImage} />
              ) : (
                <Text style={styles.heroAvatarInitials}>{avatarInitials}</Text>
              )}
            </View>

            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroEmail}>{displayEmail}</Text>

            <View style={styles.storeBadge}>
              <Text style={styles.storeBadgeIcon}>•</Text>
              <Text style={styles.storeBadgeLabel}>{displayStore}</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoChip}>
              <Text style={styles.infoChipIcon}>•</Text>
              <Text style={styles.infoChipLabel}>Lokal ang data mo</Text>
            </View>

            <Text style={styles.infoBody}>{helperBody}</Text>
          </View>

          <View style={styles.detailsCard}>
            {isAuthenticated && isEditing ? (
              <View style={styles.detailsEditContent}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PANGALAN</Text>
                  <TextInput
                    value={fullNameInput}
                    onChangeText={setFullNameInput}
                    placeholder="May-ari ng Tindahan"
                    style={styles.fieldInput}
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>EMAIL</Text>
                  <TextInput
                    value={displayEmail}
                    editable={false}
                    selectTextOnFocus={false}
                    style={styles.fieldInputReadOnly}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>TINDAHAN</Text>
                  <TextInput
                    value={storeNameInput}
                    onChangeText={setStoreNameInput}
                    placeholder="My Store"
                    style={styles.fieldInput}
                    placeholderTextColor={colors.muted}
                  />
                </View>

                {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}

                <View style={styles.detailsCardActions}>
                  <Pressable style={styles.secondaryButton} onPress={handleCancelEdit}>
                    <Text style={styles.secondaryButtonLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={() => void handleSaveProfile()} disabled={isSaving}>
                    <Text style={styles.primaryButtonLabel}>{isSaving ? 'Saving...' : 'Save'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <SummaryRow label="PANGALAN" value={displayName} />
                <SummaryRow label="EMAIL" value={displayEmail} />
                <SummaryRow label="TINDAHAN" value={displayStore} isLast />
              </>
            )}
          </View>

          {isAuthenticated ? (
            <View style={styles.authenticatedSection}>
              <View style={styles.actionSection}>
                {isEditing ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void handleRemoveAvatar()}
                    disabled={isRemovingAvatar}
                  >
                    <Text style={styles.secondaryButtonLabel}>
                      {isRemovingAvatar ? 'Removing...' : 'Remove avatar'}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable style={styles.primaryButton} onPress={handleStartEdit}>
                      <Text style={styles.primaryButtonLabel}>Edit profile</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
                      <Text style={styles.secondaryButtonLabel}>Sign out</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.actionSection}>
              <Pressable style={styles.primaryButton} onPress={() => void showSignUp()}>
                <Text style={styles.primaryButtonLabel}>Gumawa ng Account</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={showLogin}>
                <Text style={styles.secondaryButtonLabel}>Mag-log In</Text>
              </Pressable>
            </View>
          )}
        </View>
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
    paddingBottom: 32,
  },
  heroSection: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 44,
  },
  heroPatternLarge: {
    position: 'absolute',
    top: -28,
    right: -18,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroPatternSmall: {
    position: 'absolute',
    left: -24,
    bottom: 18,
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroPageTitle: {
    alignSelf: 'stretch',
    color: colors.surface,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 24,
  },
  heroAvatarShell: {
    width: 84,
    height: 84,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroAvatarInitials: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  heroName: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  storeBadgeIcon: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
  storeBadgeLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  contentSection: {
    gap: 18,
    marginTop: -22,
    paddingHorizontal: 24,
  },
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(20, 87, 70, 0.08)',
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  infoChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#E8F2F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  infoChipIcon: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  infoChipLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  infoBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  detailsCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 2,
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },
  detailsEditContent: {
    gap: 14,
    paddingVertical: 14,
  },
  summaryRow: {
    gap: 8,
    paddingVertical: 18,
  },
  summaryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 41, 37, 0.08)',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryValue: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  summaryChevron: {
    color: colors.muted,
    fontSize: 20,
    lineHeight: 20,
  },
  actionSection: {
    gap: 12,
    paddingBottom: 8,
  },
  authenticatedSection: {
    paddingTop: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldInputReadOnly: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.muted,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorMessage: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  detailsCardActions: {
    gap: 10,
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
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
    borderColor: 'rgba(102, 112, 107, 0.24)',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  secondaryButtonLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
