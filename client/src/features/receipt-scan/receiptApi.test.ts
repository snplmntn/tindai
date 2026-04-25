import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  getClientEnv: () => ({
    EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:4000',
  }),
}));

import { confirmReceiptOnBackend } from './receiptApi';

type MockResponseInit = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

function createMockResponse({ ok, status = ok ? 200 : 500, json }: MockResponseInit) {
  return {
    ok,
    status,
    json,
  } as Response;
}

describe('receiptApi', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('confirms reviewed receipt items through the backend', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: async () => ({
          receiptId: 'receipt-1',
          status: 'COMMITTED',
          transactionId: 'txn-1',
          appliedItems: 2,
          skippedItems: 1,
          aliasesSaved: 1,
          createdItems: 0,
        }),
      }),
    );

    const result = await confirmReceiptOnBackend({
      accessToken: 'token-123',
      receiptId: 'receipt-1',
      idempotencyKey: 'receipt-confirm-1',
      payload: {
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            action: 'MATCH_EXISTING',
            productId: 'item-1',
            quantity: 2,
            unitCost: 65,
            rawName: 'COKE 1.5L',
            displayName: 'Coca-Cola 1.5 Liter',
            matchedAlias: 'coke 1.5l',
          },
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:4000/api/v1/receipts/receipt-1/confirm', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'receipt-confirm-1',
      },
      body: JSON.stringify({
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            action: 'MATCH_EXISTING',
            productId: 'item-1',
            quantity: 2,
            unitCost: 65,
            rawName: 'COKE 1.5L',
            displayName: 'Coca-Cola 1.5 Liter',
            matchedAlias: 'coke 1.5l',
          },
        ],
      }),
    });
    expect(result.status).toBe('COMMITTED');
    expect(result.appliedItems).toBe(2);
  });

  it('maps invalid confirm payload errors to user-facing copy', async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Invalid receipt confirm payload.',
        }),
      }),
    );

    await expect(
      confirmReceiptOnBackend({
        accessToken: 'token-123',
        receiptId: 'receipt-1',
        idempotencyKey: 'receipt-confirm-1',
        payload: {
          items: [
            {
              receiptItemId: 'receipt-1-item-1',
              action: 'SKIP',
              rawName: 'COKE 1.5L',
            },
          ],
        },
      }),
    ).rejects.toThrow('May kulang sa napiling ayos ng mga item. Balikan muna ang resibo bago ituloy.');
  });
});
