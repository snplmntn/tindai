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
  return profile?.fullName?.trim() || 'Store owner';
}

function getDisplayEmail(profile: RemoteProfile | null) {
  return profile?.email?.trim() || 'No email available';
}

function getDisplayStore(storeName: string | undefined) {
  return storeName?.trim() || 'No store connected';
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
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
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
        <View style={styles.pageHeader}>
          <Text style={styles.pageLabel}>Profile</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarShell}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{avatarInitials}</Text>
              )}
            </View>

            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>{displayName}</Text>
              <Text style={styles.heroMeta}>{displayEmail}</Text>
              <Text style={styles.heroStore}>{displayStore}</Text>
            </View>
          </View>

          <Text style={styles.heroBody}>
            {isAuthenticated
              ? 'Your account and store details are ready on this phone.'
              : 'Sign in when you want this phone to stay connected to your store online.'}
          </Text>
        </View>

        <View style={styles.detailsCard}>
          {isAuthenticated && isEditing ? (
            <View style={styles.detailsEditContent}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={fullNameInput}
                  onChangeText={setFullNameInput}
                  placeholder="Store owner"
                  style={styles.fieldInput}
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput value={displayEmail} editable={false} selectTextOnFocus={false} style={styles.fieldInputReadOnly} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Store</Text>
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
                <Pressable style={styles.ghostButton} onPress={handleCancelEdit}>
                  <Text style={styles.ghostButtonLabel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={() => void handleSaveProfile()} disabled={isSaving}>
                  <Text style={styles.primaryButtonLabel}>{isSaving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <SummaryRow label="Name" value={displayName} />
              <SummaryRow label="Email" value={displayEmail} />
              <SummaryRow label="Store" value={displayStore} isLast />
            </>
          )}
        </View>

        {isAuthenticated ? (
          <View style={styles.authenticatedSection}>
            <View style={styles.actionSection}>
              {isEditing ? (
                <Pressable style={styles.ghostButton} onPress={() => void handleRemoveAvatar()} disabled={isRemovingAvatar}>
                  <Text style={styles.ghostButtonLabel}>{isRemovingAvatar ? 'Removing...' : 'Remove avatar'}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable style={styles.ghostButton} onPress={handleStartEdit}>
                    <Text style={styles.ghostButtonLabel}>Edit profile</Text>
                  </Pressable>
                  <Pressable style={styles.ghostButton} onPress={() => void signOut()}>
                    <Text style={styles.ghostButtonLabel}>Sign out</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.actionSection}>
            <Text style={styles.ctaBody}>Choose how you want to connect this phone to your account.</Text>
            <View style={styles.ctaActions}>
              <Pressable style={styles.ghostButton} onPress={showLogin}>
                <Text style={styles.ghostButtonLabel}>Log in</Text>
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
    paddingTop: 10,
    paddingBottom: 32,
    gap: 18,
  },
  pageHeader: {
    paddingTop: 6,
  },
  pageLabel: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 22,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: colors.primaryDeep,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroTextBlock: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroMeta: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  heroStore: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  heroBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  detailsCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  detailsEditContent: {
    gap: 14,
    paddingVertical: 14,
  },
  summaryRow: {
    gap: 8,
    paddingVertical: 16,
  },
  summaryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  actionSection: {
    gap: 12,
    paddingTop: 4,
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
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  fieldInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldInputReadOnly: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.muted,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorMessage: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  detailsCardActions: {
    gap: 10,
    marginTop: 2,
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
  ghostButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  ghostButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
