import { getClientEnv } from '@/config/env';

export type RemoteProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

type ProfileResponse = {
  profile?: RemoteProfile;
  message?: string;
};

export async function fetchMyProfile(accessToken: string): Promise<RemoteProfile> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/profile/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as ProfileResponse | null;

  if (!response.ok || !payload?.profile) {
    throw new Error(payload?.message ?? 'Unable to load profile.');
  }

  return payload.profile;
}
