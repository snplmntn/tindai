import Fuse from 'fuse.js';

import { getSupabaseAdminClient } from '../config/supabase';
import { getStoreByOwnerId } from './store.model';

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

export type MatchReceiptInputItem = {
  receiptItemId: string;
  rawName: string;
  normalizedName?: string;
  quantity?: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  parserConfidence?: number;
  status?: 'PARSED';
};

export type MatchReceiptInput = {
  items: MatchReceiptInputItem[];
};

export type MatchStatus = 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'UNMATCHED';

export type MatchReceiptResultItem = {
  receiptItemId: string;
  rawName: string;
  normalizedName: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  parserConfidence: number | null;
  matchStatus: MatchStatus;
  matchScore: number | null;
  suggestedProductId: string | null;
  suggestedProductName: string | null;
  suggestedProductSku: string | null;
  matchedAlias: string | null;
};

export type MatchReceiptResult = {
  receiptId: string;
  status: 'MATCHED';
  items: MatchReceiptResultItem[];
};

const MIN_USABLE_CHARACTER_COUNT = 12;
const MIN_WORD_COUNT = 3;
const MAX_RAW_TEXT_LENGTH = 20000;
const HIGH_CONFIDENCE_THRESHOLD = 0.25;
const NEEDS_REVIEW_THRESHOLD = 0.45;
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

type InventoryMatchRecord = {
  id: string;
  name: string;
  sku: string | null;
  aliases: string[] | null;
};

type ReceiptMatchCandidate = {
  productId: string;
  productName: string;
  productSku: string | null;
  aliases: string[];
  searchName: string;
  searchSku: string;
  searchAliases: string[];
};

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

export function isValidMatchReceiptInput(value: unknown): value is MatchReceiptInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<MatchReceiptInput>;
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return false;
  }

  return payload.items.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const candidate = item as Partial<MatchReceiptInputItem>;
    return typeof candidate.receiptItemId === 'string' && candidate.receiptItemId.trim().length > 0 && typeof candidate.rawName === 'string' && candidate.rawName.trim().length > 0;
  });
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

function buildReceiptMatchCandidates(items: InventoryMatchRecord[]): ReceiptMatchCandidate[] {
  return items.map((item) => ({
    productId: item.id,
    productName: item.name,
    productSku: item.sku,
    aliases: item.aliases ?? [],
    searchName: normalizeReceiptText(item.name),
    searchSku: normalizeReceiptText(item.sku ?? ''),
    searchAliases: (item.aliases ?? []).map((alias) => normalizeReceiptText(alias)).filter(Boolean),
  }));
}

function createReceiptFuseIndex(candidates: ReceiptMatchCandidate[]) {
  return new Fuse(candidates, {
    includeScore: true,
    threshold: NEEDS_REVIEW_THRESHOLD,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'searchName', weight: 0.5 },
      { name: 'searchSku', weight: 0.2 },
      { name: 'searchAliases', weight: 0.3 },
    ],
  });
}

function inferMatchedAlias(candidate: ReceiptMatchCandidate, normalizedName: string) {
  if (candidate.searchName === normalizedName) {
    return candidate.productName;
  }

  const aliasIndex = candidate.searchAliases.findIndex((alias) => alias === normalizedName);
  return aliasIndex >= 0 ? candidate.aliases[aliasIndex] ?? null : null;
}

function getMatchStatus(score: number | null): MatchStatus {
  if (score === null || score > NEEDS_REVIEW_THRESHOLD) {
    return 'UNMATCHED';
  }

  if (score <= HIGH_CONFIDENCE_THRESHOLD) {
    return 'HIGH_CONFIDENCE';
  }

  return 'NEEDS_REVIEW';
}

export function matchReceiptItemsAgainstCatalog(
  receiptId: string,
  items: MatchReceiptInputItem[],
  inventoryItems: InventoryMatchRecord[],
): MatchReceiptResult {
  const candidates = buildReceiptMatchCandidates(inventoryItems);
  const fuse = createReceiptFuseIndex(candidates);

  return {
    receiptId,
    status: 'MATCHED',
    items: items.map((item) => {
      const normalizedName = normalizeReceiptText(item.normalizedName?.trim() || item.rawName);
      const result = normalizedName ? fuse.search(normalizedName, { limit: 1 })[0] : undefined;
      const score = typeof result?.score === 'number' ? Number(result.score.toFixed(5)) : null;
      const matchStatus = getMatchStatus(score);
      const candidate = matchStatus === 'UNMATCHED' ? null : result?.item ?? null;

      return {
        receiptItemId: item.receiptItemId,
        rawName: item.rawName,
        normalizedName,
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
        lineTotal: typeof item.lineTotal === 'number' ? item.lineTotal : null,
        parserConfidence: typeof item.parserConfidence === 'number' ? item.parserConfidence : null,
        matchStatus,
        matchScore: score,
        suggestedProductId: candidate?.productId ?? null,
        suggestedProductName: candidate?.productName ?? null,
        suggestedProductSku: candidate?.productSku ?? null,
        matchedAlias: candidate ? inferMatchedAlias(candidate, normalizedName) : null,
      };
    }),
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

export async function matchReceiptForOwner(
  ownerId: string,
  receiptId: string,
  input: MatchReceiptInput,
): Promise<MatchReceiptResult> {
  const store = await getStoreByOwnerId(ownerId);
  if (!store) {
    throw new Error('Store not found.');
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, sku, aliases')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .is('archived_at', null)
    .returns<InventoryMatchRecord[]>();

  if (error) {
    throw new Error('Unable to load store inventory for receipt matching.');
  }

  return matchReceiptItemsAgainstCatalog(receiptId, input.items, data ?? []);
}
