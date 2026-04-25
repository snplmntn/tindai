import { describe, expect, it } from 'vitest';

import {
  assessReceiptOcrQuality,
  isValidParseReceiptInput,
  isValidReceiptOcrInput,
  normalizeOcrText,
  normalizeReceiptText,
  parseReceiptText,
} from '../models/receipts.model';

describe('receipts.model', () => {
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
      merchantName: 'ABC WHOLESALE',
      receiptDate: '2026-04-25',
      subtotalAmount: 173,
      taxAmount: 20.76,
      totalAmount: 173,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      rawName: 'COKE 1.5L',
      normalizedName: 'coke 1.5l',
      quantity: 2,
      unitPrice: 65,
      lineTotal: 130,
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
});
