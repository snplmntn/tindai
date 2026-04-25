import { describe, expect, it } from 'vitest';

import { assessReceiptOcrText, extractReceiptTextWithPlaceholder } from './receiptOcr';

describe('receiptOcr', () => {
  it('marks sparse OCR text as weak', () => {
    expect(assessReceiptOcrText('123')).toEqual({
      status: 'weak',
      message: 'Kaunti pa lang ang nabasang laman ng resibo. Subukan ulit ang mas malinaw na kuha.',
    });
  });

  it('accepts fuller OCR text as usable', () => {
    expect(assessReceiptOcrText('COKE 1.5L 2 65.00')).toEqual({
      status: 'usable',
      message: null,
    });
  });

  it('builds a placeholder OCR payload from the receipt draft', async () => {
    const extraction = await extractReceiptTextWithPlaceholder({
      id: 'receipt-1',
      source: 'gallery',
      originalUri: 'file:///receipt-original.jpg',
      compressedUri: 'file:///receipt.jpg',
      tempPath: 'C:/tmp/receipt.jpg',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 1800,
      fileSize: 256000,
      createdAt: '2026-04-26T10:00:00.000Z',
      qualityIssues: [],
    });

    expect(extraction.provider).toBe('placeholder');
    expect(extraction.rawText).toContain('receipt.jpg');
    expect(extraction.ocrBlocks).toHaveLength(4);
    expect(extraction.imageMeta).toEqual({
      width: 1200,
      height: 1800,
      fileSize: 256000,
    });
  });
});
