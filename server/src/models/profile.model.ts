import { getSupabaseAdminClient } from '../config/supabase';

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

type ProfileRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type UpsertProfileByUserIdInput = {
  userId: string;
  userEmail: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

type ClearProfileAvatarByUserIdInput = {
  userId: string;
  userEmail: string | null;
};

function mapProfileRecord(data: ProfileRecord): Profile {
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
  };
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle<ProfileRecord>();

  if (error) {
    throw new Error('Profile lookup failed.');
  }

  if (!data) {
    return null;
  }

  return mapProfileRecord(data);
}

export async function upsertProfileByUserId({
  userId,
  userEmail,
  fullName,
  avatarUrl,
}: UpsertProfileByUserIdInput): Promise<Profile> {
  const supabase = getSupabaseAdminClient();
  const updatePayload: {
    id: string;
    email: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } = {
    id: userId,
    email: userEmail,
  };

  if (fullName !== undefined) {
    updatePayload.full_name = fullName;
  }

  if (avatarUrl !== undefined) {
    updatePayload.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(updatePayload, {
      onConflict: 'id',
    })
    .select('id, email, full_name, avatar_url')
    .single<ProfileRecord>();

  if (error || !data) {
    throw new Error('Profile update failed.');
  }

  return mapProfileRecord(data);
}

export async function clearProfileAvatarByUserId({
  userId,
  userEmail,
}: ClearProfileAvatarByUserIdInput): Promise<Profile> {
  return upsertProfileByUserId({
    userId,
    userEmail,
    avatarUrl: null,
  });
}
