export type ReceiptQualityIssueSeverity = 'warning' | 'error';
export type ReceiptQualityIssueCode =
  | 'missing_file'
  | 'small_dimensions'
  | 'small_file_size'
  | 'wide_aspect_ratio';

export type ReceiptQualityIssue = {
  code: ReceiptQualityIssueCode;
  severity: ReceiptQualityIssueSeverity;
  message: string;
};

type ReceiptImageMetrics = {
  width: number;
  height: number;
  fileSize: number;
};

const MIN_RECEIPT_WIDTH = 900;
const MIN_RECEIPT_HEIGHT = 900;
const MIN_RECEIPT_FILE_SIZE = 45 * 1024;
const MAX_RECEIPT_ASPECT_RATIO = 4;

export function assessReceiptImageQuality({ width, height, fileSize }: ReceiptImageMetrics): ReceiptQualityIssue[] {
  const issues: ReceiptQualityIssue[] = [];

  if (width < MIN_RECEIPT_WIDTH || height < MIN_RECEIPT_HEIGHT) {
    issues.push({
      code: 'small_dimensions',
      severity: 'warning',
      message: 'Mukhang maliit ang kuha. Mas malinaw kung lalapit pa ang kuha sa resibo.',
    });
  }

  if (fileSize < MIN_RECEIPT_FILE_SIZE) {
    issues.push({
      code: 'small_file_size',
      severity: 'warning',
      message: 'Masyadong magaan ang image file. Posibleng kulang sa detalye ang resibo.',
    });
  }

  const aspectRatio = Math.max(width, height) / Math.max(1, Math.min(width, height));
  if (aspectRatio > MAX_RECEIPT_ASPECT_RATIO) {
    issues.push({
      code: 'wide_aspect_ratio',
      severity: 'warning',
      message: 'Mukhang putol o sobrang pahaba ang kuha. Siguraduhing kasya ang buong resibo.',
    });
  }

  return issues;
}

export function hasBlockingReceiptIssues(issues: ReceiptQualityIssue[]) {
  return issues.some((issue) => issue.severity === 'error');
}

export function formatReceiptFileSize(fileSize: number) {
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
}
