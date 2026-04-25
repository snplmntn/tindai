import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { createStoreByOwnerId, getStoreByOwnerId, updateStoreNameByOwnerId } from '../models/store.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/store.model', () => ({
  getStoreByOwnerId: vi.fn(),
  updateStoreNameByOwnerId: vi.fn(),
  createStoreByOwnerId: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetStoreByOwnerId = vi.mocked(getStoreByOwnerId);
const mockedUpdateStoreNameByOwnerId = vi.mocked(updateStoreNameByOwnerId);
const mockedCreateStoreByOwnerId = vi.mocked(createStoreByOwnerId);

function mockAuthenticatedUser(userMetadata: Record<string, unknown> = {}) {
  mockedGetSupabaseAdminClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'owner@tindai.app',
            app_metadata: {},
            user_metadata: userMetadata,
          },
        },
        error: null,
      }),
    },
  } as never);
}

describe('POST /api/v1/store/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing store without creating a new one', async () => {
    mockAuthenticatedUser();
    mockedGetStoreByOwnerId.mockResolvedValue({
      id: 'store-123',
      ownerId: 'user-123',
      name: 'Existing Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/v1/store/bootstrap')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedCreateStoreByOwnerId).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      store: {
        id: 'store-123',
        ownerId: 'user-123',
        name: 'Existing Store',
        currencyCode: 'PHP',
        timezone: 'Asia/Manila',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
      created: false,
    });
  });

  it('creates a store from user metadata when missing', async () => {
    mockAuthenticatedUser({ store_name: 'Nena Sari-Sari Store' });
    mockedGetStoreByOwnerId.mockResolvedValue(null);
    mockedCreateStoreByOwnerId.mockResolvedValue({
      id: 'store-123',
      ownerId: 'user-123',
      name: 'Nena Sari-Sari Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/v1/store/bootstrap')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedCreateStoreByOwnerId).toHaveBeenCalledWith('user-123', 'Nena Sari-Sari Store');
    expect(response.body).toEqual({
      store: {
        id: 'store-123',
        ownerId: 'user-123',
        name: 'Nena Sari-Sari Store',
        currencyCode: 'PHP',
        timezone: 'Asia/Manila',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
      created: true,
    });
  });
});

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

describe('PATCH /api/v1/store/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the authenticated user store name', async () => {
    mockAuthenticatedUser();
    mockedUpdateStoreNameByOwnerId.mockResolvedValue({
      id: 'store-123',
      ownerId: 'user-123',
      name: 'Nena Sari-Sari Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    const response = await request(app)
      .patch('/api/v1/store/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '  Nena Sari-Sari Store  ' })
      .expect(200);

    expect(mockedUpdateStoreNameByOwnerId).toHaveBeenCalledWith('user-123', 'Nena Sari-Sari Store');
    expect(response.body).toEqual({
      store: {
        id: 'store-123',
        ownerId: 'user-123',
        name: 'Nena Sari-Sari Store',
        currencyCode: 'PHP',
        timezone: 'Asia/Manila',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    });
  });

  it('returns 400 when store name is missing', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .patch('/api/v1/store/me')
      .set('Authorization', 'Bearer valid-token')
      .send({})
      .expect(400);

    expect(response.body).toEqual({
      message: 'Store name is required.',
    });
  });

  it('returns 400 when store name is empty after trim', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .patch('/api/v1/store/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '   ' })
      .expect(400);

    expect(response.body).toEqual({
      message: 'Store name cannot be empty.',
    });
  });

  it('returns 404 when the authenticated user has no store', async () => {
    mockAuthenticatedUser();
    mockedUpdateStoreNameByOwnerId.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/v1/store/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Tindai Store' })
      .expect(404);

    expect(response.body).toEqual({
      message: 'Store not found.',
    });
  });
});
