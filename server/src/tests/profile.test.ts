import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { clearProfileAvatarByUserId, getProfileByUserId, upsertProfileByUserId } from '../models/profile.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/profile.model', () => ({
  getProfileByUserId: vi.fn(),
  upsertProfileByUserId: vi.fn(),
  clearProfileAvatarByUserId: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetProfileByUserId = vi.mocked(getProfileByUserId);
const mockedUpsertProfileByUserId = vi.mocked(upsertProfileByUserId);
const mockedClearProfileAvatarByUserId = vi.mocked(clearProfileAvatarByUserId);

function mockAuthenticatedUser(userOverrides?: { email?: string | null; fullName?: string | null }) {
  const fullName = userOverrides?.fullName ?? null;

  mockedGetSupabaseAdminClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: userOverrides?.email ?? 'hello@tindai.app',
            app_metadata: {},
            user_metadata: fullName ? { full_name: fullName } : {},
          },
        },
        error: null,
      }),
    },
  } as never);
}

describe('GET /api/v1/profile/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current user profile through the model layer', async () => {
    mockAuthenticatedUser();

    mockedGetProfileByUserId.mockResolvedValue({
      id: 'user-123',
      email: 'hello@tindai.app',
      fullName: 'Tindai User',
      avatarUrl: null,
    });

    const response = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedGetProfileByUserId).toHaveBeenCalledWith('user-123');
    expect(response.body).toEqual({
      profile: {
        id: 'user-123',
        email: 'hello@tindai.app',
        fullName: 'Tindai User',
        avatarUrl: null,
      },
    });
  });

  it('returns fallback profile details when no profile row exists yet', async () => {
    mockAuthenticatedUser({ email: 'owner@tindai.app', fullName: 'Owner Name' });
    mockedGetProfileByUserId.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body).toEqual({
      profile: {
        id: 'user-123',
        email: 'owner@tindai.app',
        fullName: 'Owner Name',
        avatarUrl: null,
      },
    });
  });
});

describe('PATCH /api/v1/profile/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates trimmed profile fields', async () => {
    mockAuthenticatedUser({ email: 'owner@tindai.app' });
    mockedUpsertProfileByUserId.mockResolvedValue({
      id: 'user-123',
      email: 'owner@tindai.app',
      fullName: 'Ana Mercado',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });

    const response = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', 'Bearer valid-token')
      .send({
        fullName: '  Ana Mercado  ',
        avatarUrl: '  https://cdn.example.com/avatar.png  ',
      })
      .expect(200);

    expect(mockedUpsertProfileByUserId).toHaveBeenCalledWith({
      userId: 'user-123',
      userEmail: 'owner@tindai.app',
      fullName: 'Ana Mercado',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });
    expect(response.body).toEqual({
      profile: {
        id: 'user-123',
        email: 'owner@tindai.app',
        fullName: 'Ana Mercado',
        avatarUrl: 'https://cdn.example.com/avatar.png',
      },
    });
  });

  it('clears profile fields when blank strings are submitted', async () => {
    mockAuthenticatedUser({ email: 'owner@tindai.app' });
    mockedUpsertProfileByUserId.mockResolvedValue({
      id: 'user-123',
      email: 'owner@tindai.app',
      fullName: null,
      avatarUrl: null,
    });

    await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', 'Bearer valid-token')
      .send({
        fullName: '   ',
        avatarUrl: '   ',
      })
      .expect(200);

    expect(mockedUpsertProfileByUserId).toHaveBeenCalledWith({
      userId: 'user-123',
      userEmail: 'owner@tindai.app',
      fullName: null,
      avatarUrl: null,
    });
  });

  it('returns 400 when profile fields have invalid types', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', 'Bearer valid-token')
      .send({
        fullName: 123,
      })
      .expect(400);

    expect(mockedUpsertProfileByUserId).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      message: 'fullName must be a string.',
    });
  });

  it('returns 400 when no profile fields are provided', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .patch('/api/v1/profile/me')
      .set('Authorization', 'Bearer valid-token')
      .send({})
      .expect(400);

    expect(mockedUpsertProfileByUserId).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      message: 'At least one profile field is required.',
    });
  });
});

describe('DELETE /api/v1/profile/me/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears only the authenticated user avatar field', async () => {
    mockAuthenticatedUser({ email: 'owner@tindai.app' });
    mockedClearProfileAvatarByUserId.mockResolvedValue({
      id: 'user-123',
      email: 'owner@tindai.app',
      fullName: 'Ana Mercado',
      avatarUrl: null,
    });

    const response = await request(app)
      .delete('/api/v1/profile/me/avatar')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedClearProfileAvatarByUserId).toHaveBeenCalledWith({
      userId: 'user-123',
      userEmail: 'owner@tindai.app',
    });
    expect(response.body).toEqual({
      profile: {
        id: 'user-123',
        email: 'owner@tindai.app',
        fullName: 'Ana Mercado',
        avatarUrl: null,
      },
    });
  });
});
