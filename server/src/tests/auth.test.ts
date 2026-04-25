import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe('GET /api/v1/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the bearer token is missing', async () => {
    const response = await request(app).get('/api/v1/auth/me').expect(401);

    expect(response.body).toEqual({
      message: 'Missing bearer token.',
    });
  });

  it('returns the authenticated Supabase user payload', async () => {
    mockedGetSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'hello@tindai.app',
              app_metadata: { provider: 'email' },
              user_metadata: { name: 'Tindai User' },
            },
          },
          error: null,
        }),
      },
    } as never);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: 'user-123',
        email: 'hello@tindai.app',
        appMetadata: { provider: 'email' },
        userMetadata: { name: 'Tindai User' },
      },
    });
  });
});

describe('POST /api/v1/auth/google/exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when idToken is missing', async () => {
    const response = await request(app).post('/api/v1/auth/google/exchange').send({}).expect(400);

    expect(response.body).toEqual({
      message: 'idToken is required.',
    });
  });

  it('returns session and user payload for a valid Google ID token', async () => {
    mockedGetSupabaseAdminClient.mockReturnValue({
      auth: {
        signInWithIdToken: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'hello@tindai.app',
              app_metadata: { provider: 'google' },
              user_metadata: { name: 'Tindai User' },
            },
            session: {
              access_token: 'access-token',
              refresh_token: 'refresh-token',
              token_type: 'bearer',
              expires_at: 1_800_000_000,
              expires_in: 3600,
            },
          },
          error: null,
        }),
      },
    } as never);

    const response = await request(app)
      .post('/api/v1/auth/google/exchange')
      .send({ idToken: 'google-id-token' })
      .expect(200);

    expect(response.body).toEqual({
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'bearer',
        expiresAt: 1_800_000_000,
        expiresIn: 3600,
      },
      user: {
        id: 'user-123',
        email: 'hello@tindai.app',
        appMetadata: { provider: 'google' },
        userMetadata: { name: 'Tindai User' },
      },
    });
  });
});
