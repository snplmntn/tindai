import { getClientEnv } from '@/config/env';

export type RemoteProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export type UpdateMyProfileInput = {
  fullName?: string;
  avatarUrl?: string;
};

export type RemoteStore = {
  id: string;
  ownerId: string;
  name: string;
  currencyCode: string;
  timezone: string;
  updatedAt: string;
};

type ProfileResponse = {
  profile?: RemoteProfile;
  message?: string;
};

type StoreResponse = {
  store?: RemoteStore;
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

export async function updateMyProfile(accessToken: string, input: UpdateMyProfileInput): Promise<RemoteProfile> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/profile/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
  if (!response.ok || !payload?.profile) {
    throw new Error(payload?.message ?? 'Unable to update profile.');
  }

  return payload.profile;
}

export async function clearMyProfileAvatar(accessToken: string): Promise<RemoteProfile> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/profile/me/avatar`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
  if (!response.ok || !payload?.profile) {
    throw new Error(payload?.message ?? 'Unable to remove avatar.');
  }

  return payload.profile;
}

export async function updateMyStoreName(accessToken: string, name: string): Promise<RemoteStore> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/store/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
    }),
  });

  const payload = (await response.json().catch(() => null)) as StoreResponse | null;
  if (!response.ok || !payload?.store) {
    throw new Error(payload?.message ?? 'Unable to update store name.');
  }

  return payload.store;
}
