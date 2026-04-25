import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { getStoreByOwnerId } from '../models/store.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/store.model', () => ({
  getStoreByOwnerId: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetStoreByOwnerId = vi.mocked(getStoreByOwnerId);

function mockAuthenticatedUser() {
  mockedGetSupabaseAdminClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'owner@tindai.app',
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  } as never);
}

describe('GET /api/v1/store/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the authenticated user store', async () => {
    mockAuthenticatedUser();
    mockedGetStoreByOwnerId.mockResolvedValue({
      id: 'store-123',
      ownerId: 'user-123',
      name: 'Tindai Demo Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    const response = await request(app)
      .get('/api/v1/store/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedGetStoreByOwnerId).toHaveBeenCalledWith('user-123');
    expect(response.body).toEqual({
      store: {
        id: 'store-123',
        ownerId: 'user-123',
        name: 'Tindai Demo Store',
        currencyCode: 'PHP',
        timezone: 'Asia/Manila',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    });
  });

  it('returns 404 when the authenticated user has no store', async () => {
    mockAuthenticatedUser();
    mockedGetStoreByOwnerId.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/store/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(404);

    expect(response.body).toEqual({
      message: 'Store not found.',
    });
  });
});
