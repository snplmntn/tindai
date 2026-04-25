export type ReceiptOcrBlockInput = {
  text: string;
};

export type ReceiptOcrImageMetaInput = {
  width: number;
  height: number;
  fileSize: number;
};

export type ProcessReceiptOcrInput = {
  rawText: string;
  ocrBlocks: ReceiptOcrBlockInput[];
  imageMeta: ReceiptOcrImageMetaInput;
  provider: 'placeholder' | 'ml_kit';
};

export type ProcessReceiptOcrResult = {
  receiptId: string;
  status: 'OCR_DONE';
  ocrQuality: 'usable' | 'weak';
  retryRecommended: boolean;
  normalizedText: string;
  rawText: string;
  ocrBlockCount: number;
  imageMeta: ReceiptOcrImageMetaInput;
};

export type ParseReceiptInput = {
  rawText: string;
};

export type ParsedReceiptItem = {
  receiptItemId: string;
  rawName: string;
  normalizedName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  parserConfidence: number;
  status: 'PARSED';
};

export type ParseReceiptResult = {
  receiptId: string;
  status: 'PARSED';
  merchantName: string | null;
  receiptDate: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: ParsedReceiptItem[];
};

const MIN_USABLE_CHARACTER_COUNT = 12;
const MIN_WORD_COUNT = 3;
const MAX_RAW_TEXT_LENGTH = 20000;
const RECEIPT_NOISE_WORDS = [
  'subtotal',
  'total',
  'vat',
  'tax',
  'cash',
  'change',
  'cashier',
  'visa',
  'mastercard',
  'thank you',
  'official receipt',
  'balance due',
  'amount due',
];

export function normalizeOcrText(rawText: string) {
  return rawText.replace(/\s+/g, ' ').trim();
}

export function normalizeReceiptText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\b(subtotal|total|vat|tax|cash|change|qty|pc|pcs|amount|amt|cashier)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidReceiptOcrInput(value: unknown): value is ProcessReceiptOcrInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<ProcessReceiptOcrInput>;
  if (typeof payload.rawText !== 'string' || payload.rawText.trim().length === 0 || payload.rawText.length > MAX_RAW_TEXT_LENGTH) {
    return false;
  }

  if (payload.provider !== 'placeholder' && payload.provider !== 'ml_kit') {
    return false;
  }

  if (
    !payload.imageMeta ||
    typeof payload.imageMeta !== 'object' ||
    typeof payload.imageMeta.width !== 'number' ||
    payload.imageMeta.width <= 0 ||
    typeof payload.imageMeta.height !== 'number' ||
    payload.imageMeta.height <= 0 ||
    typeof payload.imageMeta.fileSize !== 'number' ||
    payload.imageMeta.fileSize <= 0
  ) {
    return false;
  }

  if (!Array.isArray(payload.ocrBlocks)) {
    return false;
  }

  return payload.ocrBlocks.every((block) => block && typeof block === 'object' && typeof block.text === 'string');
}

export function isValidParseReceiptInput(value: unknown): value is ParseReceiptInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<ParseReceiptInput>;
  return typeof payload.rawText === 'string' && payload.rawText.trim().length > 0 && payload.rawText.length <= MAX_RAW_TEXT_LENGTH;
}

export function assessReceiptOcrQuality(rawText: string): ProcessReceiptOcrResult['ocrQuality'] {
  const normalized = normalizeOcrText(rawText);
  const usableCharacterCount = normalized.replace(/[^a-z0-9]/gi, '').length;
  const wordCount = normalized ? normalized.split(' ').length : 0;

  if (!normalized || usableCharacterCount < MIN_USABLE_CHARACTER_COUNT || wordCount < MIN_WORD_COUNT) {
    return 'weak';
  }

  return 'usable';
}

export async function processReceiptOcrForOwner(
  _ownerId: string,
  receiptId: string,
  input: ProcessReceiptOcrInput,
): Promise<ProcessReceiptOcrResult> {
  const normalizedText = normalizeOcrText(input.rawText);
  const ocrQuality = assessReceiptOcrQuality(input.rawText);

  return {
    receiptId,
    status: 'OCR_DONE',
    ocrQuality,
    retryRecommended: ocrQuality === 'weak',
    normalizedText,
    rawText: input.rawText,
    ocrBlockCount: input.ocrBlocks.length,
    imageMeta: input.imageMeta,
  };
}

function splitReceiptLines(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAmount(rawAmount: string) {
  const normalized = rawAmount.replace(/,/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function extractLastAmount(line: string) {
  const matches = line.match(/(\d[\d,]*\.\d{2})/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  return parseAmount(matches[matches.length - 1]);
}

function looksLikeDateLine(line: string) {
  return /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/.test(line);
}

function parseReceiptDate(rawText: string) {
  const match = rawText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (!match) {
    return null;
  }

  if (match[1] && match[2] && match[3]) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  if (match[4] && match[5] && match[6]) {
    const month = Number(match[4]);
    const day = Number(match[5]);
    const year = Number(match[6].length === 2 ? `20${match[6]}` : match[6]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  return null;
}

function extractMerchantName(lines: string[]) {
  for (const line of lines.slice(0, 5)) {
    const lowered = line.toLowerCase();
    const letterCount = (line.match(/[a-z]/gi) ?? []).length;
    if (
      letterCount >= 4 &&
      !RECEIPT_NOISE_WORDS.some((word) => lowered.includes(word)) &&
      !looksLikeDateLine(line) &&
      !/\d[\d,]*\.\d{2}/.test(line)
    ) {
      return line.replace(/\s+/g, ' ').trim();
    }
  }

  return null;
}

function extractSummaryAmounts(lines: string[]) {
  let subtotalAmount: number | null = null;
  let taxAmount: number | null = null;
  let totalAmount: number | null = null;

  for (const line of lines) {
    const lowered = line.toLowerCase();
    const amount = extractLastAmount(line);
    if (amount === null) {
      continue;
    }

    if (subtotalAmount === null && lowered.includes('subtotal')) {
      subtotalAmount = amount;
      continue;
    }

    if (taxAmount === null && (lowered.includes('vat') || lowered.includes('tax'))) {
      taxAmount = amount;
      continue;
    }

    if (
      lowered.includes('total') &&
      !lowered.includes('subtotal') &&
      !lowered.includes('total discount')
    ) {
      totalAmount = amount;
    }
  }

  return {
    subtotalAmount,
    taxAmount,
    totalAmount,
  };
}

function isNoiseLine(line: string) {
  const lowered = line.toLowerCase();
  return RECEIPT_NOISE_WORDS.some((word) => lowered.includes(word));
}

function createParsedItem(receiptId: string, index: number, rawName: string, quantity: number, unitPrice: number | null, lineTotal: number | null, parserConfidence: number): ParsedReceiptItem {
  return {
    receiptItemId: `${receiptId}-item-${index + 1}`,
    rawName: rawName.trim(),
    normalizedName: normalizeReceiptText(rawName),
    quantity: Number(quantity.toFixed(3)),
    unitPrice,
    lineTotal,
    parserConfidence,
    status: 'PARSED',
  };
}

function parseCandidateLineItem(line: string, receiptId: string, index: number): ParsedReceiptItem | null {
  if (!/[a-z]/i.test(line) || isNoiseLine(line)) {
    return null;
  }

  let match = line.match(/^(.*?)(?:\s{1,}|\s*-\s*)(\d+(?:\.\d+)?)\s*[x@]\s*(\d[\d,]*\.\d{2})$/i);
  if (match) {
    const rawName = match[1].trim();
    const quantity = Number.parseFloat(match[2]);
    const unitPrice = parseAmount(match[3]);
    if (rawName && quantity > 0 && unitPrice !== null) {
      return createParsedItem(receiptId, index, rawName, quantity, unitPrice, Number((quantity * unitPrice).toFixed(2)), 0.93);
    }
  }

  match = line.match(/^(.*?)(?:\s{1,}|\s*-\s*)(\d+(?:\.\d+)?)\s+(\d[\d,]*\.\d{2})$/i);
  if (match) {
    const rawName = match[1].trim();
    const quantity = Number.parseFloat(match[2]);
    const unitPrice = parseAmount(match[3]);
    if (rawName && quantity > 0 && unitPrice !== null) {
      return createParsedItem(receiptId, index, rawName, quantity, unitPrice, Number((quantity * unitPrice).toFixed(2)), 0.84);
    }
  }

  match = line.match(/^(.*?)(?:\s{1,}|\s*-\s*)(\d[\d,]*\.\d{2})$/i);
  if (match) {
    const rawName = match[1].trim();
    const lineTotal = parseAmount(match[2]);
    if (rawName && lineTotal !== null) {
      return createParsedItem(receiptId, index, rawName, 1, lineTotal, lineTotal, 0.68);
    }
  }

  return null;
}

export function parseReceiptText(receiptId: string, rawText: string): ParseReceiptResult {
  const lines = splitReceiptLines(rawText);
  const merchantName = extractMerchantName(lines);
  const receiptDate = parseReceiptDate(rawText);
  const { subtotalAmount, taxAmount, totalAmount } = extractSummaryAmounts(lines);

  const items = lines
    .map((line, index) => parseCandidateLineItem(line, receiptId, index))
    .filter((item): item is ParsedReceiptItem => item !== null && item.normalizedName.length > 0);

  return {
    receiptId,
    status: 'PARSED',
    merchantName,
    receiptDate,
    subtotalAmount,
    taxAmount,
    totalAmount,
    items,
  };
}

export async function parseReceiptForOwner(
  _ownerId: string,
  receiptId: string,
  input: ParseReceiptInput,
): Promise<ParseReceiptResult> {
  return parseReceiptText(receiptId, input.rawText);
}
