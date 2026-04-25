import { describe, expect, it } from 'vitest';

import { assessReceiptImageQuality, formatReceiptFileSize, hasBlockingReceiptIssues } from './receiptQuality';

describe('receiptCapture', () => {
  it('flags small images with warnings', () => {
    const issues = assessReceiptImageQuality({
      width: 640,
      height: 640,
      fileSize: 20 * 1024,
    });

    expect(issues.map((issue) => issue.code)).toContain('small_dimensions');
    expect(issues.map((issue) => issue.code)).toContain('small_file_size');
    expect(hasBlockingReceiptIssues(issues)).toBe(false);
  });

  it('flags unusually long aspect ratios', () => {
    const issues = assessReceiptImageQuality({
      width: 2200,
      height: 420,
      fileSize: 120 * 1024,
    });

    expect(issues.map((issue) => issue.code)).toContain('wide_aspect_ratio');
  });

  it('accepts a clear receipt image without warnings', () => {
    const issues = assessReceiptImageQuality({
      width: 1200,
      height: 1800,
      fileSize: 240 * 1024,
    });

    expect(issues).toHaveLength(0);
  });

  it('formats file sizes for display', () => {
    expect(formatReceiptFileSize(64 * 1024)).toBe('64 KB');
    expect(formatReceiptFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
