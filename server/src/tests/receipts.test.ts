import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { matchReceiptForOwner } from '../models/receipts.model';
import { parseReceiptForOwner } from '../models/receipts.model';
import { processReceiptOcrForOwner } from '../models/receipts.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/receipts.model', async () => {
  const actual = await vi.importActual<typeof import('../models/receipts.model')>('../models/receipts.model');
  return {
    ...actual,
    matchReceiptForOwner: vi.fn(),
    parseReceiptForOwner: vi.fn(),
    processReceiptOcrForOwner: vi.fn(),
  };
});

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedMatchReceiptForOwner = vi.mocked(matchReceiptForOwner);
const mockedParseReceiptForOwner = vi.mocked(parseReceiptForOwner);
const mockedProcessReceiptOcrForOwner = vi.mocked(processReceiptOcrForOwner);

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

describe('POST /api/v1/receipts/:receiptId/process-ocr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts OCR payloads for authenticated users', async () => {
    mockAuthenticatedUser();
    mockedProcessReceiptOcrForOwner.mockResolvedValue({
      receiptId: 'receipt-123',
      status: 'OCR_DONE',
      ocrQuality: 'usable',
      retryRecommended: false,
      normalizedText: 'COKE 1.5L 2 65.00',
      rawText: 'COKE 1.5L 2 65.00',
      ocrBlockCount: 1,
      imageMeta: {
        width: 1080,
        height: 1920,
        fileSize: 240000,
      },
    });

    const response = await request(app)
      .post('/api/v1/receipts/receipt-123/process-ocr')
      .set('Authorization', 'Bearer valid-token')
      .send({
        rawText: 'COKE 1.5L 2 65.00',
        ocrBlocks: [{ text: 'COKE 1.5L 2 65.00' }],
        imageMeta: {
          width: 1080,
          height: 1920,
          fileSize: 240000,
        },
        provider: 'placeholder',
      })
      .expect(200);

    expect(mockedProcessReceiptOcrForOwner).toHaveBeenCalledWith('user-123', 'receipt-123', {
      rawText: 'COKE 1.5L 2 65.00',
      ocrBlocks: [{ text: 'COKE 1.5L 2 65.00' }],
      imageMeta: {
        width: 1080,
        height: 1920,
        fileSize: 240000,
      },
      provider: 'placeholder',
    });
    expect(response.body.status).toBe('OCR_DONE');
  });

  it('returns 400 for invalid OCR payloads', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .post('/api/v1/receipts/receipt-123/process-ocr')
      .set('Authorization', 'Bearer valid-token')
      .send({
        rawText: '',
        ocrBlocks: [],
        imageMeta: {
          width: 1080,
          height: 1920,
          fileSize: 240000,
        },
        provider: 'placeholder',
      })
      .expect(400);

    expect(response.body).toEqual({
      message: 'Invalid receipt OCR payload.',
    });
  });
});

describe('POST /api/v1/receipts/:receiptId/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses OCR text for authenticated users', async () => {
    mockAuthenticatedUser();
    mockedParseReceiptForOwner.mockResolvedValue({
      receiptId: 'receipt-123',
      status: 'PARSED',
      merchantName: 'ABC WHOLESALE',
      receiptDate: '2026-04-25',
      subtotalAmount: 130,
      taxAmount: null,
      totalAmount: 130,
      items: [
        {
          receiptItemId: 'receipt-123-item-1',
          rawName: 'COKE 1.5L',
          normalizedName: 'coke 1.5l',
          quantity: 2,
          unitPrice: 65,
          lineTotal: 130,
          parserConfidence: 0.88,
          status: 'PARSED',
        },
      ],
    });

    const response = await request(app)
      .post('/api/v1/receipts/receipt-123/parse')
      .set('Authorization', 'Bearer valid-token')
      .send({
        rawText: 'ABC WHOLESALE\nCOKE 1.5L 2 65.00\nTOTAL 130.00',
      })
      .expect(200);

    expect(mockedParseReceiptForOwner).toHaveBeenCalledWith('user-123', 'receipt-123', {
      rawText: 'ABC WHOLESALE\nCOKE 1.5L 2 65.00\nTOTAL 130.00',
    });
    expect(response.body.status).toBe('PARSED');
  });

  it('returns 400 for invalid parse payloads', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .post('/api/v1/receipts/receipt-123/parse')
      .set('Authorization', 'Bearer valid-token')
      .send({
        rawText: '',
      })
      .expect(400);

    expect(response.body).toEqual({
      message: 'Invalid receipt parse payload.',
    });
  });
});

describe('POST /api/v1/receipts/:receiptId/match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches parsed items for authenticated users', async () => {
    mockAuthenticatedUser();
    mockedMatchReceiptForOwner.mockResolvedValue({
      receiptId: 'receipt-123',
      status: 'MATCHED',
      items: [
        {
          receiptItemId: 'receipt-123-item-1',
          rawName: 'COKE 1.5L',
          normalizedName: 'coke 1.5l',
          quantity: 2,
          unitPrice: 65,
          lineTotal: 130,
          parserConfidence: 0.88,
          matchStatus: 'HIGH_CONFIDENCE',
          matchScore: 0.12,
          suggestedProductId: 'item-1',
          suggestedProductName: 'Coca-Cola 1.5 Liter',
          suggestedProductSku: 'COKE15',
          matchedAlias: 'coke 1.5l',
        },
      ],
    });

    const response = await request(app)
      .post('/api/v1/receipts/receipt-123/match')
      .set('Authorization', 'Bearer valid-token')
      .send({
        items: [
          {
            receiptItemId: 'receipt-123-item-1',
            rawName: 'COKE 1.5L',
            normalizedName: 'coke 1.5l',
          },
        ],
      })
      .expect(200);

    expect(mockedMatchReceiptForOwner).toHaveBeenCalledWith('user-123', 'receipt-123', {
      items: [
        {
          receiptItemId: 'receipt-123-item-1',
          rawName: 'COKE 1.5L',
          normalizedName: 'coke 1.5l',
        },
      ],
    });
    expect(response.body.status).toBe('MATCHED');
  });

  it('returns 400 for invalid match payloads', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .post('/api/v1/receipts/receipt-123/match')
      .set('Authorization', 'Bearer valid-token')
      .send({
        items: [],
      })
      .expect(400);

    expect(response.body).toEqual({
      message: 'Invalid receipt match payload.',
    });
  });
});
