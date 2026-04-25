import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assessReceiptOcrQuality,
  confirmReceiptForOwner,
  isValidMatchReceiptInput,
  isValidConfirmReceiptInput,
  isValidParseReceiptInput,
  isValidReceiptOcrInput,
  mergeGeminiReceiptNames,
  matchReceiptItemsAgainstCatalog,
  normalizeOcrText,
  normalizeReceiptText,
  parseReceiptText,
  standardizeMatchReceiptInputItemsWithDictionary,
  standardizeParsedReceiptResultWithDictionary,
  shouldAttemptGeminiReceiptEnrichment,
} from '../models/receipts.model';
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

describe('receipts.model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes OCR text for downstream parsing', () => {
    expect(normalizeOcrText('  COKE   1.5L \n 2 65.00  ')).toBe('COKE 1.5L 2 65.00');
  });

  it('marks sparse OCR text as weak', () => {
    expect(assessReceiptOcrQuality('123')).toBe('weak');
  });

  it('marks fuller OCR text as usable', () => {
    expect(assessReceiptOcrQuality('COKE 1.5L 2 65.00')).toBe('usable');
  });

  it('validates the OCR payload shape', () => {
    expect(
      isValidReceiptOcrInput({
        rawText: 'COKE 1.5L 2 65.00',
        ocrBlocks: [{ text: 'COKE 1.5L 2 65.00' }],
        imageMeta: {
          width: 1080,
          height: 1920,
          fileSize: 240000,
        },
        provider: 'placeholder',
      }),
    ).toBe(true);

    expect(
      isValidReceiptOcrInput({
        rawText: '',
        ocrBlocks: [],
        imageMeta: {
          width: 1080,
          height: 1920,
          fileSize: 240000,
        },
        provider: 'placeholder',
      }),
    ).toBe(false);
  });

  it('normalizes parsed item text for matching', () => {
    expect(normalizeReceiptText('COKE 1.5L @ 65.00')).toBe('coke 1.5l 65.00');
  });

  it('validates the parse payload shape', () => {
    expect(
      isValidParseReceiptInput({
        rawText: 'ABC WHOLESALE\nCOKE 1.5L 2 65.00\nTOTAL 130.00',
      }),
    ).toBe(true);

    expect(
      isValidParseReceiptInput({
        rawText: '',
      }),
    ).toBe(false);
  });

  it('validates the receipt match payload shape', () => {
    expect(
      isValidMatchReceiptInput({
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            rawName: 'COKE 1.5L',
          },
        ],
      }),
    ).toBe(true);

    expect(
      isValidMatchReceiptInput({
        items: [],
      }),
    ).toBe(false);
  });

  it('validates the receipt confirm payload shape', () => {
    expect(
      isValidConfirmReceiptInput({
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            action: 'MATCH_EXISTING',
            productId: 'item-1',
            quantity: 2,
            unitCost: 65,
            rawName: 'COKE 1.5L',
          },
          {
            receiptItemId: 'receipt-1-item-2',
            action: 'SKIP',
            rawName: 'PLASTIC BAG',
          },
        ],
      }),
    ).toBe(true);

    expect(
      isValidConfirmReceiptInput({
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            action: 'MATCH_EXISTING',
          },
        ],
      }),
    ).toBe(false);
  });

  it('parses merchant, date, summary amounts, and candidate items deterministically', () => {
    const result = parseReceiptText(
      'receipt-123',
      [
        'ABC WHOLESALE',
        '04/25/2026',
        'COKE 1.5L 2 65.00',
        'SPRITE MISMO 2 x 21.50',
        'Subtotal 173.00',
        'VAT 20.76',
        'TOTAL 173.00',
        'THANK YOU',
      ].join('\n'),
    );

    expect(result).toMatchObject({
      receiptId: 'receipt-123',
      status: 'PARSED',
      nameEnrichmentStatus: 'local_only',
      merchantName: 'ABC WHOLESALE',
      receiptDate: '2026-04-25',
      subtotalAmount: 173,
      taxAmount: 20.76,
      totalAmount: 173,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      rawName: 'COKE 1.5L',
      displayName: 'COKE 1.5L',
      normalizedName: 'coke 1.5l',
      quantity: 2,
      unitPrice: 65,
      lineTotal: 130,
      nameSource: 'ocr',
      status: 'PARSED',
    });
    expect(result.items[1]).toMatchObject({
      rawName: 'SPRITE MISMO',
      quantity: 2,
      unitPrice: 21.5,
      lineTotal: 43,
    });
  });

  it('parses single-price item lines and filters obvious noise lines', () => {
    const result = parseReceiptText(
      'receipt-456',
      [
        'BESTMART',
        'Cashier: ANA',
        'NISSIN WAFER 18.00',
        'Visa',
        'Change 2.00',
      ].join('\n'),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      rawName: 'NISSIN WAFER',
      quantity: 1,
      unitPrice: 18,
      lineTotal: 18,
    });
  });

  it('supports comma decimal amounts and drops weak one-letter item names', () => {
    const result = parseReceiptText(
      'receipt-999',
      [
        'MERCADO STORE',
        'I 1 81,44',
        'Coke mismo 2 21,50',
        'TOTAL 43,00',
      ].join('\n'),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      rawName: 'Coke mismo',
      displayName: 'Coke mismo',
      quantity: 2,
      unitPrice: 21.5,
      lineTotal: 43,
    });
  });

  it('parses two-line POS receipt items with quantity, unit price, and amount on the next line', () => {
    const result = parseReceiptText(
      'receipt-pos',
      [
        'PTE DC S',
        'item Qty Price Amount',
        'Wings Solve Pwd Floral Fresh 60g/150',
        '150.00 5.85 877.50',
        'Select Vinegar 200ml/48',
        '96.00 6.60 633.60',
        'TOTAL AMOUNT 4,967.70',
      ].join('\n'),
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      rawName: 'Wings Solve Pwd Floral Fresh 60g/150',
      quantity: 150,
      unitPrice: 5.85,
      lineTotal: 877.5,
    });
    expect(result.items[1]).toMatchObject({
      rawName: 'Select Vinegar 200ml/48',
      quantity: 96,
      unitPrice: 6.6,
      lineTotal: 633.6,
    });
  });

  it('standardizes parsed receipt item names from the centralized receipt dictionary', async () => {
    const standardized = await standardizeParsedReceiptResultWithDictionary(
      {
        receiptId: 'receipt-dict',
        status: 'PARSED',
        nameEnrichmentStatus: 'local_only',
        merchantName: 'SUPPLIER',
        receiptDate: null,
        subtotalAmount: null,
        taxAmount: null,
        totalAmount: null,
        items: [
          {
            receiptItemId: 'receipt-dict-item-1',
            rawName: 'CHSDOG',
            displayName: 'CHSDOG',
            normalizedName: 'chsdog',
            quantity: 1,
            unitPrice: 212,
            lineTotal: 212,
            parserConfidence: 0.7,
            nameSource: 'ocr',
            nameConfidence: null,
            status: 'PARSED',
          },
          {
            receiptItemId: 'receipt-dict-item-2',
            rawName: 'Select Vinegar 200ml/48',
            displayName: 'Select Vinegar 200ml/48',
            normalizedName: 'select vinegar 200ml 48',
            quantity: 96,
            unitPrice: 6.6,
            lineTotal: 633.6,
            parserConfidence: 0.82,
            nameSource: 'ocr',
            nameConfidence: null,
            status: 'PARSED',
          },
        ],
      },
      [
        {
          code: 'TJCHSDOG1KG',
          name: 'Tender Juicy Cheese Dog 1kg',
          category: 'frozen',
          unit: 'pack',
        },
        {
          code: 'SELVIN200',
          name: 'Select Vinegar 200ml',
          category: 'condiments',
          unit: 'bottle',
        },
      ],
    );

    expect(standardized.items[0]).toMatchObject({
      rawName: 'CHSDOG',
      displayName: 'Tender Juicy Cheese Dog 1kg',
      normalizedName: 'tender juicy cheese dog 1kg',
    });
    expect(standardized.items[1]).toMatchObject({
      rawName: 'Select Vinegar 200ml/48',
      displayName: 'Select Vinegar 200ml',
      normalizedName: 'select vinegar 200ml',
    });
  });

  it('flags abbreviated receipt names for optional Gemini enrichment', () => {
    expect(
      shouldAttemptGeminiReceiptEnrichment([
        {
          receiptItemId: 'receipt-1-item-1',
          rawName: 'Select Soy Sauce 200ml/48',
          displayName: 'Select Soy Sauce 200ml/48',
          normalizedName: 'select soy sauce 200ml 48',
          quantity: 96,
          unitPrice: 9.4,
          lineTotal: 902.4,
          parserConfidence: 0.84,
          nameSource: 'ocr',
          nameConfidence: null,
          status: 'PARSED',
        },
      ]),
    ).toBe(true);
  });

  it('merges confident Gemini display names without losing the original receipt text', () => {
    const merged = mergeGeminiReceiptNames(
      {
        receiptId: 'receipt-1',
        status: 'PARSED',
        nameEnrichmentStatus: 'fallback_local',
        merchantName: 'PTE',
        receiptDate: null,
        subtotalAmount: null,
        taxAmount: null,
        totalAmount: null,
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            rawName: 'Select Vinegar 200ml/48',
            displayName: 'Select Vinegar 200ml/48',
            normalizedName: 'select vinegar 200ml 48',
            quantity: 96,
            unitPrice: 6.6,
            lineTotal: 633.6,
            parserConfidence: 0.84,
            nameSource: 'ocr',
            nameConfidence: null,
            status: 'PARSED',
          },
        ],
      },
      {
        items: [
          {
            receiptItemId: 'receipt-1-item-1',
            displayName: 'Select White Vinegar 200ml',
            confidence: 0.91,
          },
        ],
      },
    );

    expect(merged.nameEnrichmentStatus).toBe('gemini_enriched');
    expect(merged.items[0]).toMatchObject({
      rawName: 'Select Vinegar 200ml/48',
      displayName: 'Select White Vinegar 200ml',
      normalizedName: 'select white vinegar 200ml',
      nameSource: 'gemini',
      nameConfidence: 0.91,
    });
  });

  it('allows gemini fallback parse results to drive clearer matching names', async () => {
    const result = await matchReceiptItemsAgainstCatalog(
      'receipt-790',
      [
        {
          receiptItemId: 'receipt-790-item-1',
          rawName: 'Wings Solve Pwd Floral Fresh 60g/150',
          displayName: 'Wings Powder Floral Fresh 60g',
          normalizedName: 'wings powder floral fresh 60g',
          quantity: 150,
          unitPrice: 5.85,
          lineTotal: 877.5,
          parserConfidence: 0.87,
          nameSource: 'gemini',
          nameConfidence: 0.87,
        },
      ],
      [
        {
          id: 'item-5',
          name: 'Wings Powder Floral Fresh 60g',
          sku: 'WINGS-60-FLORAL',
          aliases: ['wings solve pwd floral fresh 60g', 'wings powder floral fresh'],
        },
      ],
    );

    expect(result.items[0]).toMatchObject({
      rawName: 'Wings Solve Pwd Floral Fresh 60g/150',
      displayName: 'Wings Powder Floral Fresh 60g',
      nameSource: 'gemini',
      matchStatus: 'HIGH_CONFIDENCE',
      suggestedProductId: 'item-5',
    });
  });

  it('matches parsed items against product names, skus, and aliases with fuse thresholds', async () => {
    const result = await matchReceiptItemsAgainstCatalog(
      'receipt-789',
      [
        {
          receiptItemId: 'receipt-789-item-1',
          rawName: 'COKE 1.5L',
          normalizedName: 'coke 1.5l',
          quantity: 2,
          unitPrice: 65,
          lineTotal: 130,
          parserConfidence: 0.88,
        },
        {
          receiptItemId: 'receipt-789-item-2',
          rawName: 'SPRYT MISMO',
          normalizedName: 'spryt mismo',
          quantity: 1,
          unitPrice: 21,
          lineTotal: 21,
          parserConfidence: 0.7,
        },
        {
          receiptItemId: 'receipt-789-item-3',
          rawName: 'UNKNOWN SOAP',
          normalizedName: 'unknown soap',
        },
      ],
      [
        {
          id: 'item-1',
          name: 'Coca-Cola 1.5 Liter',
          sku: 'COKE15',
          aliases: ['coke 1.5l', 'coke litro', 'coke 1 5l'],
        },
        {
          id: 'item-2',
          name: 'Sprite Mismo',
          sku: 'SPRITE-MIS',
          aliases: ['sprite mismo', 'sprt mismo'],
        },
      ],
    );

    expect(result.status).toBe('MATCHED');
    expect(result.items[0]).toMatchObject({
      displayName: 'COKE 1.5L',
      matchStatus: 'HIGH_CONFIDENCE',
      suggestedProductId: 'item-1',
      suggestedProductName: 'Coca-Cola 1.5 Liter',
    });
    expect(result.items[1]).toMatchObject({
      matchStatus: 'HIGH_CONFIDENCE',
      suggestedProductId: 'item-2',
    });
    expect(result.items[2]).toMatchObject({
      matchStatus: 'UNMATCHED',
      suggestedProductId: null,
      suggestedProductName: null,
    });
  });

  it('standardizes match input items with the centralized receipt dictionary before store matching', async () => {
    const standardizedItems = await standardizeMatchReceiptInputItemsWithDictionary(
      [
        {
          receiptItemId: 'receipt-800-item-1',
          rawName: 'CHSDOG',
          quantity: 1,
          unitPrice: 212,
          lineTotal: 212,
          parserConfidence: 0.77,
        },
      ],
      [
        {
          code: 'TJCHSDOG1KG',
          name: 'Tender Juicy Cheese Dog 1kg',
          category: 'frozen',
          unit: 'pack',
        },
      ],
    );

    const result = await matchReceiptItemsAgainstCatalog(
      'receipt-800',
      standardizedItems,
      [
        {
          id: 'item-chsdog',
          name: 'Tender Juicy Cheese Dog 1kg',
          sku: 'TJCHSDOG1KG',
          aliases: ['cheese dog', 'tj cheese dog'],
        },
      ],
    );

    expect(result.items[0]).toMatchObject({
      rawName: 'CHSDOG',
      displayName: 'Tender Juicy Cheese Dog 1kg',
      matchStatus: 'HIGH_CONFIDENCE',
      suggestedProductId: 'item-chsdog',
    });
  });

  it('confirms receipt items by creating transaction, movement, and alias updates', async () => {
    mockedGetStoreByOwnerId.mockResolvedValue({
      id: 'store-1',
      ownerId: 'user-1',
      name: 'Tindai Store',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    const inventoryRows = [
      {
        id: 'item-1',
        store_id: 'store-1',
        name: 'Coca-Cola 1.5 Liter',
        aliases: ['coke 1.5l'],
        unit: 'pcs',
        cost: 50,
        price: 65,
        current_stock: 12,
        low_stock_threshold: 2,
        is_active: true,
        archived_at: null,
        updated_at: '2026-04-25T00:00:00.000Z',
      },
    ];

    const transactionsInsertSingle = vi.fn().mockResolvedValue({
      data: { id: 'txn-1', metadata: null },
      error: null,
    });
    const transactionsUpdateEq = vi.fn().mockResolvedValue({
      error: null,
    });
    const transactionItemsInsertSingle = vi.fn().mockResolvedValue({
      data: { id: 'txn-item-1' },
      error: null,
    });
    const movementInsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const inventoryUpdateSelectSingle = vi.fn().mockResolvedValue({
      data: {
        ...inventoryRows[0],
        aliases: ['coke 1.5l', 'COKE 1.5L'],
      },
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: transactionsInsertSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: transactionsUpdateEq,
            })),
          })),
        };
      }

      if (table === 'inventory_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn().mockResolvedValue({
                  data: inventoryRows,
                  error: null,
                }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: inventoryUpdateSelectSingle,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'transaction_items') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: transactionItemsInsertSingle,
            })),
          })),
        };
      }

      if (table === 'inventory_movements') {
        return {
          insert: movementInsert,
        };
      }

      throw new Error(`Unhandled table mock: ${table}`);
    });

    mockedGetSupabaseAdminClient.mockReturnValue({ from } as never);

    const result = await confirmReceiptForOwner('user-1', 'receipt-1', 'receipt-confirm-1', {
      items: [
        {
          receiptItemId: 'receipt-1-item-1',
          action: 'MATCH_EXISTING',
          productId: 'item-1',
          quantity: 2,
          unitCost: 65,
          rawName: 'COKE 1.5L',
          displayName: 'Coca-Cola 1.5 Liter',
          matchedAlias: 'COKE 1.5L',
        },
        {
          receiptItemId: 'receipt-1-item-2',
          action: 'SKIP',
          rawName: 'PLASTIC BAG',
        },
      ],
    });

    expect(result).toEqual({
      receiptId: 'receipt-1',
      status: 'COMMITTED',
      transactionId: 'txn-1',
      appliedItems: 1,
      skippedItems: 1,
      aliasesSaved: 1,
      createdItems: 0,
    });
    expect(movementInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: 'store-1',
        item_id: 'item-1',
        transaction_id: 'txn-1',
        transaction_item_id: 'txn-item-1',
        movement_type: 'receipt_import',
        quantity_delta: 2,
        client_mutation_id: 'receipt-confirm-1:0',
      }),
    );
  });
});
