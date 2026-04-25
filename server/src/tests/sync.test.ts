import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { verifyTransactionsForOwner } from '../models/sync.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/sync.model', () => ({
  verifyTransactionsForOwner: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedVerifyTransactionsForOwner = vi.mocked(verifyTransactionsForOwner);

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

describe('POST /api/v1/verify-transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies transactions for authenticated users', async () => {
    mockAuthenticatedUser();
    mockedVerifyTransactionsForOwner.mockResolvedValue({
      storeId: 'store-123',
      results: [
        {
          clientMutationId: 'mutation-1',
          status: 'synced',
        },
      ],
    });

    const response = await request(app)
      .post('/api/v1/verify-transactions')
      .set('Authorization', 'Bearer valid-token')
      .send({
        transactions: [
          {
            clientMutationId: 'mutation-1',
            rawText: 'nakabenta coke',
            source: 'typed',
            parserSource: 'offline_rule_parser',
            isUtang: false,
            items: [{ itemName: 'Coke Mismo', quantityDelta: -1, unitPrice: 20 }],
          },
        ],
      })
      .expect(200);

    expect(mockedVerifyTransactionsForOwner).toHaveBeenCalledWith('user-123', expect.any(Array));
    expect(response.body).toEqual({
      storeId: 'store-123',
      results: [{ clientMutationId: 'mutation-1', status: 'synced' }],
    });
  });

  it('returns 400 for empty batches', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .post('/api/v1/verify-transactions')
      .set('Authorization', 'Bearer valid-token')
      .send({ transactions: [] })
      .expect(400);

    expect(response.body).toEqual({
      message: 'transactions must be a non-empty array.',
    });
  });
});
