import Fuse from 'fuse.js';

import { getEnv } from '../config/env';
import { getSupabaseAdminClient } from '../config/supabase';
import {
  buildReceiptParseFallbackPrompt,
  buildReceiptNameEnrichmentPrompt,
  validateGeminiReceiptParseFallbackResponse,
  validateGeminiReceiptNameEnrichmentResponse,
} from '../services/gemini-receipt-enrichment';
import { generateGeminiText } from '../services/gemini.service';
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
  displayName: string;
  normalizedName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  parserConfidence: number;
  nameSource: 'ocr' | 'gemini';
  nameConfidence: number | null;
  status: 'PARSED';
};

export type ParseReceiptResult = {
  receiptId: string;
  status: 'PARSED';
  nameEnrichmentStatus: 'local_only' | 'gemini_enriched' | 'fallback_local' | 'gemini_fallback';
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
  displayName?: string;
  normalizedName?: string;
  quantity?: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  parserConfidence?: number;
  nameSource?: 'ocr' | 'gemini';
  nameConfidence?: number | null;
  status?: 'PARSED';
};

export type MatchReceiptInput = {
  items: MatchReceiptInputItem[];
};

export type MatchStatus = 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'UNMATCHED';

export type MatchReceiptResultItem = {
  receiptItemId: string;
  rawName: string;
  displayName: string;
  normalizedName: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  parserConfidence: number | null;
  nameSource: 'ocr' | 'gemini';
  nameConfidence: number | null;
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

export type ConfirmReceiptAction = 'MATCH_EXISTING' | 'CREATE_PRODUCT' | 'SKIP';

export type ConfirmReceiptInputItem = {
  receiptItemId: string;
  action: ConfirmReceiptAction;
  productId?: string;
  createProductName?: string;
  quantity?: number;
  unitCost?: number | null;
  rawName: string;
  displayName?: string;
  matchedAlias?: string | null;
};

export type ConfirmReceiptInput = {
  items: ConfirmReceiptInputItem[];
};

export type ConfirmReceiptResult = {
  receiptId: string;
  status: 'COMMITTED';
  transactionId: string;
  appliedItems: number;
  skippedItems: number;
  aliasesSaved: number;
  createdItems: number;
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

const GEMINI_RECEIPT_NAME_ENRICHMENT_SCHEMA = {
  type: 'OBJECT',
  required: ['items'],
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['receiptItemId', 'displayName', 'confidence'],
        properties: {
          receiptItemId: { type: 'STRING' },
          displayName: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
      },
    },
  },
} as const;

const GEMINI_RECEIPT_PARSE_FALLBACK_SCHEMA = {
  type: 'OBJECT',
  required: ['items'],
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['rawName', 'displayName', 'quantity', 'confidence'],
        properties: {
          rawName: { type: 'STRING' },
          displayName: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unitPrice: { type: 'NUMBER', nullable: true },
          lineTotal: { type: 'NUMBER', nullable: true },
          confidence: { type: 'NUMBER' },
        },
      },
    },
  },
} as const;

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

function normalizeReceiptCode(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type InventoryMatchRecord = {
  id: string;
  name: string;
  sku: string | null;
  aliases: string[] | null;
};

type ReceiptProductDictionaryRecord = {
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
};

type ReceiptEnrichmentInventoryRecord = {
  name: string;
  sku: string | null;
  aliases: string[] | null;
};

type ReceiptInventoryWriteRecord = {
  id: string;
  store_id: string;
  name: string;
  aliases: string[] | null;
  unit: string;
  cost: number | string | null;
  price: number | string;
  current_stock: number | string;
  low_stock_threshold: number | string;
  is_active: boolean;
  archived_at: string | null;
  updated_at: string;
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

type ReceiptDictionaryCandidate = {
  code: string;
  name: string;
  normalizedCode: string;
  normalizedName: string;
  normalizedNameCompact: string;
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

export function isValidConfirmReceiptInput(value: unknown): value is ConfirmReceiptInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<ConfirmReceiptInput>;
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return false;
  }

  return payload.items.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const candidate = item as Partial<ConfirmReceiptInputItem>;
    if (typeof candidate.receiptItemId !== 'string' || candidate.receiptItemId.trim().length === 0) {
      return false;
    }

    if (typeof candidate.rawName !== 'string' || candidate.rawName.trim().length === 0) {
      return false;
    }

    if (
      candidate.action !== 'MATCH_EXISTING' &&
      candidate.action !== 'CREATE_PRODUCT' &&
      candidate.action !== 'SKIP'
    ) {
      return false;
    }

    if (candidate.action === 'SKIP') {
      return true;
    }

    if (
      typeof candidate.quantity !== 'number' ||
      Number.isNaN(candidate.quantity) ||
      candidate.quantity <= 0
    ) {
      return false;
    }

    if (
      candidate.unitCost !== undefined &&
      candidate.unitCost !== null &&
      (typeof candidate.unitCost !== 'number' || Number.isNaN(candidate.unitCost) || candidate.unitCost < 0)
    ) {
      return false;
    }

    if (candidate.action === 'MATCH_EXISTING') {
      return typeof candidate.productId === 'string' && candidate.productId.trim().length > 0;
    }

    return (
      typeof candidate.createProductName === 'string' &&
      candidate.createProductName.trim().length > 0
    );
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
  const compact = rawAmount.replace(/\s+/g, '');
  const hasComma = compact.includes(',');
  const hasDot = compact.includes('.');

  let normalized = compact;
  if (hasComma && !hasDot) {
    // OCR can return comma decimals (e.g. 81,44). Treat that as decimal, not thousands.
    normalized = compact.replace(',', '.');
  } else {
    normalized = compact.replace(/,/g, '');
  }

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
    displayName: rawName.trim(),
    normalizedName: normalizeReceiptText(rawName),
    quantity: Number(quantity.toFixed(3)),
    unitPrice,
    lineTotal,
    parserConfidence,
    nameSource: 'ocr',
    nameConfidence: null,
    status: 'PARSED',
  };
}

function createGeminiParsedItem(
  receiptId: string,
  index: number,
  rawName: string,
  displayName: string,
  quantity: number,
  unitPrice: number | null,
  lineTotal: number | null,
  confidence: number,
): ParsedReceiptItem {
  const cleanedRawName = rawName.replace(/\s+/g, ' ').trim();
  const cleanedDisplayName = displayName.replace(/\s+/g, ' ').trim();

  return {
    receiptItemId: `${receiptId}-item-${index + 1}`,
    rawName: cleanedRawName,
    displayName: cleanedDisplayName || cleanedRawName,
    normalizedName: normalizeReceiptText(cleanedDisplayName || cleanedRawName),
    quantity: Number(quantity.toFixed(3)),
    unitPrice: unitPrice === null ? null : Number(unitPrice.toFixed(2)),
    lineTotal: lineTotal === null ? null : Number(lineTotal.toFixed(2)),
    parserConfidence: Number(confidence.toFixed(3)),
    nameSource: 'gemini',
    nameConfidence: Number(confidence.toFixed(3)),
    status: 'PARSED',
  };
}

function looksLikeProductName(rawName: string) {
  const compact = rawName.replace(/\s+/g, ' ').trim();
  if (compact.length < 3) {
    return false;
  }

  const letterCount = (compact.match(/[a-z]/gi) ?? []).length;
  if (letterCount < 2) {
    return false;
  }

  const tokens = compact.split(' ').filter(Boolean);
  if (tokens.length > 0 && tokens.every((token) => token.length <= 1)) {
    return false;
  }

  return true;
}

function stripReceiptCountSuffix(value: string) {
  return value
    .replace(/\/\d+\b/g, ' ')
    .replace(/\b\d+\s*(pcs?|pc|packs?|boxes?|bottles?|sachets?|cans?|rolls?|bars?|bags?|trays?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildReceiptDictionaryCandidates(records: ReceiptProductDictionaryRecord[]): ReceiptDictionaryCandidate[] {
  return records.map((record) => ({
    code: record.code,
    name: record.name,
    normalizedCode: normalizeReceiptCode(record.code),
    normalizedName: normalizeReceiptText(record.name),
    normalizedNameCompact: normalizeReceiptCode(record.name),
  }));
}

function buildReceiptDictionarySearchTerms(rawName: string, displayName?: string) {
  const values = [rawName, displayName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.replace(/\s+/g, ' ').trim());
  const textTerms = new Set<string>();
  const codeTerms = new Set<string>();

  for (const value of values) {
    const stripped = stripReceiptCountSuffix(value);

    for (const candidate of [value, stripped]) {
      const normalizedText = normalizeReceiptText(candidate);
      const normalizedCode = normalizeReceiptCode(candidate);

      if (normalizedText) {
        textTerms.add(normalizedText);
      }

      if (normalizedCode) {
        codeTerms.add(normalizedCode);
      }

      const tokens = candidate.split(/[^a-z0-9]+/i).filter(Boolean);
      for (const token of tokens) {
        const normalizedToken = normalizeReceiptCode(token);
        if (normalizedToken.length >= 5) {
          codeTerms.add(normalizedToken);
          textTerms.add(normalizedToken);
        }
      }
    }
  }

  return {
    textTerms: [...textTerms],
    codeTerms: [...codeTerms],
  };
}

function findReceiptDictionaryMatch(
  rawName: string,
  displayName: string | undefined,
  candidates: ReceiptDictionaryCandidate[],
) {
  if (candidates.length === 0) {
    return null;
  }

  const { textTerms, codeTerms } = buildReceiptDictionarySearchTerms(rawName, displayName);
  const byNormalizedCode = new Map(candidates.map((candidate) => [candidate.normalizedCode, candidate]));
  const byNormalizedName = new Map(candidates.map((candidate) => [candidate.normalizedName, candidate]));
  const byNormalizedNameCompact = new Map(candidates.map((candidate) => [candidate.normalizedNameCompact, candidate]));

  for (const term of codeTerms) {
    const directCode = byNormalizedCode.get(term);
    if (directCode) {
      return directCode;
    }

    const directNameCompact = byNormalizedNameCompact.get(term);
    if (directNameCompact) {
      return directNameCompact;
    }
  }

  for (const term of textTerms) {
    const directName = byNormalizedName.get(term);
    if (directName) {
      return directName;
    }

    const compactName = byNormalizedNameCompact.get(normalizeReceiptCode(term));
    if (compactName) {
      return compactName;
    }
  }

  let containsMatch: { candidate: ReceiptDictionaryCandidate; score: number } | null = null;

  for (const term of codeTerms) {
    if (term.length < 5) {
      continue;
    }

    for (const candidate of candidates) {
      if (
        candidate.normalizedCode.includes(term) ||
        term.includes(candidate.normalizedCode) ||
        candidate.normalizedNameCompact.includes(term) ||
        term.includes(candidate.normalizedNameCompact)
      ) {
        const score = Math.abs(candidate.normalizedCode.length - term.length);
        if (!containsMatch || score < containsMatch.score) {
          containsMatch = { candidate, score };
        }
      }
    }
  }

  if (containsMatch) {
    return containsMatch.candidate;
  }

  const fuse = new Fuse(candidates, {
    includeScore: true,
    threshold: looksLikeAbbreviatedReceiptName(rawName) ? 0.28 : 0.18,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'normalizedCode', weight: 0.45 },
      { name: 'normalizedName', weight: 0.35 },
      { name: 'normalizedNameCompact', weight: 0.2 },
    ],
  });

  const fuseQueries = [...codeTerms, ...textTerms].filter((term) => term.length >= 3);
  for (const query of fuseQueries) {
    const result = fuse.search(query, { limit: 1 })[0];
    if (result?.item && typeof result.score === 'number') {
      const threshold = looksLikeAbbreviatedReceiptName(rawName) ? 0.28 : 0.18;
      if (result.score <= threshold) {
        return result.item;
      }
    }
  }

  return null;
}

export function standardizeParsedReceiptResultWithDictionary(
  result: ParseReceiptResult,
  dictionaryRecords: ReceiptProductDictionaryRecord[],
): ParseReceiptResult {
  const candidates = buildReceiptDictionaryCandidates(dictionaryRecords);
  if (candidates.length === 0) {
    return result;
  }

  return {
    ...result,
    items: result.items.map((item) => {
      if (item.nameSource === 'gemini' && typeof item.nameConfidence === 'number' && item.nameConfidence >= 0.85) {
        return item;
      }

      const dictionaryMatch = findReceiptDictionaryMatch(item.rawName, item.displayName, candidates);
      if (!dictionaryMatch) {
        return item;
      }

      return {
        ...item,
        displayName: dictionaryMatch.name,
        normalizedName: normalizeReceiptText(dictionaryMatch.name),
      };
    }),
  };
}

export function standardizeMatchReceiptInputItemsWithDictionary(
  items: MatchReceiptInputItem[],
  dictionaryRecords: ReceiptProductDictionaryRecord[],
): MatchReceiptInputItem[] {
  const candidates = buildReceiptDictionaryCandidates(dictionaryRecords);
  if (candidates.length === 0) {
    return items;
  }

  return items.map((item) => {
    if (item.nameSource === 'gemini' && typeof item.nameConfidence === 'number' && item.nameConfidence >= 0.85) {
      return item;
    }

    const dictionaryMatch = findReceiptDictionaryMatch(item.rawName, item.displayName, candidates);
    if (!dictionaryMatch) {
      return item;
    }

    return {
      ...item,
      displayName: dictionaryMatch.name,
      normalizedName: normalizeReceiptText(dictionaryMatch.name),
    };
  });
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

function looksLikeAbbreviatedReceiptName(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return false;
  }

  const tokens = compact.split(' ').filter(Boolean);
  const shortWordCount = tokens.filter((token) => {
    const lettersOnly = token.replace(/[^a-z]/gi, '');
    return lettersOnly.length > 0 && lettersOnly.length <= 3;
  }).length;
  const digitOrSlashSignal = /[\d/]/.test(compact);
  const uppercaseTokenCount = tokens.filter((token) => /[A-Z]/.test(token) && token === token.toUpperCase()).length;

  return digitOrSlashSignal || shortWordCount >= 2 || uppercaseTokenCount >= 2;
}

export function shouldAttemptGeminiReceiptEnrichment(items: ParsedReceiptItem[]) {
  return items.some((item) => looksLikeAbbreviatedReceiptName(item.rawName));
}

export function mergeGeminiReceiptNames(
  result: ParseReceiptResult,
  enrichment: {
    items: Array<{
      receiptItemId: string;
      displayName: string;
      confidence: number;
    }>;
  },
): ParseReceiptResult {
  const enrichmentById = new Map(enrichment.items.map((item) => [item.receiptItemId, item]));

  let applied = false;
  const items = result.items.map((item) => {
    const candidate = enrichmentById.get(item.receiptItemId);
    if (!candidate || candidate.confidence < 0.72) {
      return item;
    }

    const displayName = candidate.displayName.replace(/\s+/g, ' ').trim();
    if (!displayName) {
      return item;
    }

    const normalizedName = normalizeReceiptText(displayName);
    if (!normalizedName) {
      return item;
    }

    const normalizedRawName = normalizeReceiptText(item.rawName);
    if (normalizedName === normalizedRawName) {
      return item;
    }

    applied = true;
    return {
      ...item,
      displayName,
      normalizedName,
      nameSource: 'gemini' as const,
      nameConfidence: Number(candidate.confidence.toFixed(3)),
    };
  });

  return {
    ...result,
    nameEnrichmentStatus: applied ? 'gemini_enriched' : result.nameEnrichmentStatus,
    items,
  };
}

function mergeGeminiFallbackItems(
  localResult: ParseReceiptResult,
  receiptId: string,
  fallback: {
    items: Array<{
      rawName: string;
      displayName: string;
      quantity: number;
      unitPrice: number | null;
      lineTotal: number | null;
      confidence: number;
    }>;
  },
): ParseReceiptResult {
  const items = fallback.items
    .filter((item) => item.confidence >= 0.6)
    .map((item, index) =>
      createGeminiParsedItem(
        receiptId,
        index,
        item.rawName,
        item.displayName,
        item.quantity,
        item.unitPrice,
        item.lineTotal,
        item.confidence,
      ),
    )
    .filter((item) => item.normalizedName.length > 0 && looksLikeProductName(item.displayName));

  if (items.length === 0) {
    return {
      ...localResult,
      nameEnrichmentStatus: 'fallback_local',
    };
  }

  return {
    ...localResult,
    nameEnrichmentStatus: 'gemini_fallback',
    items,
  };
}

function buildStrictJsonRetryPrompt(prompt: string) {
  return `${prompt}

IMPORTANT:
- Reply with JSON only.
- Do not include any intro text.
- Do not include markdown fences.
- Do not explain the answer.
- Do not say "Here is the JSON".
- Do not include any words before the opening brace.
- Your response is passed directly to JSON.parse().
- Any extra text will cause the response to be rejected.
- Start with { and end with }.`.trim();
}

async function loadReceiptProductDictionary() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('receipt_products')
    .select('code, name, category, unit')
    .returns<ReceiptProductDictionaryRecord[]>();

  if (error) {
    throw new Error('Unable to load centralized receipt product dictionary.');
  }

  return data ?? [];
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
      const displayName = item.displayName?.trim() || item.rawName.trim();
      const normalizedName = normalizeReceiptText(item.normalizedName?.trim() || displayName || item.rawName);
      const result = normalizedName ? fuse.search(normalizedName, { limit: 1 })[0] : undefined;
      const score = typeof result?.score === 'number' ? Number(result.score.toFixed(5)) : null;
      const matchStatus = getMatchStatus(score);
      const candidate = matchStatus === 'UNMATCHED' ? null : result?.item ?? null;

      return {
        receiptItemId: item.receiptItemId,
        rawName: item.rawName,
        displayName,
        normalizedName,
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
        lineTotal: typeof item.lineTotal === 'number' ? item.lineTotal : null,
        parserConfidence: typeof item.parserConfidence === 'number' ? item.parserConfidence : null,
        nameSource: item.nameSource === 'gemini' ? 'gemini' : 'ocr',
        nameConfidence: typeof item.nameConfidence === 'number' ? item.nameConfidence : null,
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

  let match = line.match(/^(.*?)(?:\s{1,}|\s*-\s*)(\d+(?:[.,]\d+)?)\s*[x@]\s*(\d[\d,.]*[.,]\d{2})$/i);
  if (match) {
    const rawName = match[1].trim();
    const quantity = Number.parseFloat(match[2]);
    const unitPrice = parseAmount(match[3]);
    if (looksLikeProductName(rawName) && quantity > 0 && unitPrice !== null) {
      return createParsedItem(receiptId, index, rawName, quantity, unitPrice, Number((quantity * unitPrice).toFixed(2)), 0.93);
    }
  }

  match = line.match(/^(.*?)(?:\s{1,}|\s*-\s*)(\d+(?:[.,]\d+)?)\s+(\d[\d,.]*[.,]\d{2})$/i);
  if (match) {
    const rawName = match[1].trim();
    const quantity = Number.parseFloat(match[2]);
    const unitPrice = parseAmount(match[3]);
    if (looksLikeProductName(rawName) && quantity > 0 && unitPrice !== null) {
      return createParsedItem(receiptId, index, rawName, quantity, unitPrice, Number((quantity * unitPrice).toFixed(2)), 0.84);
    }
  }

  match = line.match(/^(.*?)(?:\s{1,}|\s*-\s*)(\d[\d,.]*[.,]\d{2})$/i);
  if (match) {
    const rawName = match[1].trim();
    const lineTotal = parseAmount(match[2]);
    if (looksLikeProductName(rawName) && lineTotal !== null) {
      return createParsedItem(receiptId, index, rawName, 1, lineTotal, lineTotal, 0.68);
    }
  }

  return null;
}

function parseNumericReceiptDetailLine(line: string) {
  const matches = Array.from(line.matchAll(/(\d[\d,.]*[.,]\d{2})/g)).map((match) => match[1]);
  if (matches.length < 2) {
    return null;
  }

  const quantity = parseAmount(matches[0]);
  const unitPrice = parseAmount(matches[1]);
  const lineTotal = parseAmount(matches[matches.length - 1]);
  if (quantity === null || unitPrice === null || lineTotal === null || quantity <= 0) {
    return null;
  }

  return {
    quantity,
    unitPrice,
    lineTotal,
  };
}

function parseTwoLineReceiptItems(lines: string[], receiptId: string) {
  const items: ParsedReceiptItem[] = [];
  const consumedLineIndexes = new Set<number>();

  for (let index = 0; index < lines.length - 1; index += 1) {
    const nameLine = lines[index];
    const detailLine = lines[index + 1];

    if (consumedLineIndexes.has(index) || consumedLineIndexes.has(index + 1)) {
      continue;
    }

    if (!/[a-z]/i.test(nameLine) || isNoiseLine(nameLine) || /\d[\d,.]*[.,]\d{2}/.test(nameLine)) {
      continue;
    }

    const numericDetail = parseNumericReceiptDetailLine(detailLine);
    if (!numericDetail || !looksLikeProductName(nameLine)) {
      continue;
    }

    items.push(
      createParsedItem(
        receiptId,
        index,
        nameLine,
        numericDetail.quantity,
        numericDetail.unitPrice,
        numericDetail.lineTotal,
        0.82,
      ),
    );
    consumedLineIndexes.add(index);
    consumedLineIndexes.add(index + 1);
  }

  return {
    items,
    consumedLineIndexes,
  };
}

export function parseReceiptText(receiptId: string, rawText: string): ParseReceiptResult {
  const lines = splitReceiptLines(rawText);
  const merchantName = extractMerchantName(lines);
  const receiptDate = parseReceiptDate(rawText);
  const { subtotalAmount, taxAmount, totalAmount } = extractSummaryAmounts(lines);
  const twoLineItems = parseTwoLineReceiptItems(lines, receiptId);

  const items = lines
    .map((line, index) => {
      if (twoLineItems.consumedLineIndexes.has(index)) {
        return null;
      }

      return parseCandidateLineItem(line, receiptId, index);
    })
    .filter((item): item is ParsedReceiptItem => item !== null && item.normalizedName.length > 0);

  const mergedItems = [...twoLineItems.items, ...items].sort((left, right) =>
    left.receiptItemId.localeCompare(right.receiptItemId),
  );

  return {
    receiptId,
    status: 'PARSED',
    nameEnrichmentStatus: 'local_only',
    merchantName,
    receiptDate,
    subtotalAmount,
    taxAmount,
    totalAmount,
    items: mergedItems,
  };
}

export async function parseReceiptForOwner(
  ownerId: string,
  receiptId: string,
  input: ParseReceiptInput,
): Promise<ParseReceiptResult> {
  let localResult = parseReceiptText(receiptId, input.rawText);
  const env = getEnv();
  let dictionaryRecords: ReceiptProductDictionaryRecord[] = [];

  try {
    dictionaryRecords = await loadReceiptProductDictionary();
    localResult = standardizeParsedReceiptResultWithDictionary(localResult, dictionaryRecords);
  } catch (error) {
    console.warn('[receipt] dictionary standardization skipped during parse', error);
  }

  if (!env.GEMINI_API_KEY) {
    return localResult;
  }

  try {
    const store = await getStoreByOwnerId(ownerId);
    if (!store) {
      return {
        ...localResult,
        nameEnrichmentStatus: 'fallback_local',
      };
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('inventory_items')
      .select('name, sku, aliases')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .is('archived_at', null)
      .returns<ReceiptEnrichmentInventoryRecord[]>();

    if (error) {
      throw new Error('Unable to load store inventory for receipt enrichment.');
    }

    const inventoryItems = (data ?? []).map((item) => ({
      name: item.name,
      sku: item.sku,
      aliases: item.aliases ?? [],
    }));

    if (localResult.items.length === 0) {
      const fallbackPrompt = buildReceiptParseFallbackPrompt({
        rawText: input.rawText,
        inventoryItems,
      });
      const fallbackResponse = await generateGeminiText(fallbackPrompt, {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RECEIPT_PARSE_FALLBACK_SCHEMA,
      });
      if (!fallbackResponse) {
        return {
          ...localResult,
          nameEnrichmentStatus: 'fallback_local',
        };
      }

      let fallback;
      try {
        fallback = validateGeminiReceiptParseFallbackResponse(fallbackResponse);
      } catch {
        const retryResponse = await generateGeminiText(buildStrictJsonRetryPrompt(fallbackPrompt), {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RECEIPT_PARSE_FALLBACK_SCHEMA,
        });

        if (!retryResponse) {
          return {
            ...localResult,
            nameEnrichmentStatus: 'fallback_local',
          };
        }

        fallback = validateGeminiReceiptParseFallbackResponse(retryResponse);
      }

      return standardizeParsedReceiptResultWithDictionary(
        mergeGeminiFallbackItems(
          {
            ...localResult,
            nameEnrichmentStatus: 'fallback_local',
          },
          receiptId,
          fallback,
        ),
        dictionaryRecords,
      );
    }

    if (!shouldAttemptGeminiReceiptEnrichment(localResult.items)) {
      return localResult;
    }

    const prompt = buildReceiptNameEnrichmentPrompt({
      rawText: input.rawText,
      parsedItems: localResult.items.map((item) => ({
        receiptItemId: item.receiptItemId,
        rawName: item.rawName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      inventoryItems,
    });

    const geminiResponse = await generateGeminiText(prompt, {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RECEIPT_NAME_ENRICHMENT_SCHEMA,
    });
    if (!geminiResponse) {
      return {
        ...localResult,
        nameEnrichmentStatus: 'fallback_local',
      };
    }

    let enrichment;
    try {
      enrichment = validateGeminiReceiptNameEnrichmentResponse(geminiResponse);
    } catch {
      const retryResponse = await generateGeminiText(buildStrictJsonRetryPrompt(prompt), {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RECEIPT_NAME_ENRICHMENT_SCHEMA,
      });

      if (!retryResponse) {
        return {
          ...localResult,
          nameEnrichmentStatus: 'fallback_local',
        };
      }

      enrichment = validateGeminiReceiptNameEnrichmentResponse(retryResponse);
    }

    return standardizeParsedReceiptResultWithDictionary(
      mergeGeminiReceiptNames(
        {
          ...localResult,
          nameEnrichmentStatus: 'fallback_local',
        },
        enrichment,
      ),
      dictionaryRecords,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `[receipt] gemini enrichment failed detail=${error.message.slice(0, 240)}`,
      );
    }
    console.warn('[receipt] gemini enrichment failed', error);
    return {
      ...localResult,
      nameEnrichmentStatus: 'fallback_local',
    };
  }
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

  let standardizedItems = input.items;
  try {
    standardizedItems = standardizeMatchReceiptInputItemsWithDictionary(
      input.items,
      await loadReceiptProductDictionary(),
    );
  } catch (dictionaryError) {
    console.warn('[receipt] dictionary standardization skipped during match', dictionaryError);
  }

  return matchReceiptItemsAgainstCatalog(receiptId, standardizedItems, data ?? []);
}

function normalizeInventoryAlias(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function mergeInventoryAliases(existingAliases: string[] | null | undefined, nextAliases: Array<string | null | undefined>) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const value of [...(existingAliases ?? []), ...nextAliases]) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeInventoryAlias(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

function toFiniteNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function confirmReceiptForOwner(
  ownerId: string,
  receiptId: string,
  idempotencyKey: string,
  input: ConfirmReceiptInput,
): Promise<ConfirmReceiptResult> {
  const store = await getStoreByOwnerId(ownerId);
  if (!store) {
    throw new Error('Store not found.');
  }

  const normalizedIdempotencyKey = idempotencyKey.trim();
  if (!normalizedIdempotencyKey) {
    throw new Error('Idempotency key is required.');
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingTransaction, error: existingTransactionError } = await supabase
    .from('transactions')
    .select('id, metadata')
    .eq('store_id', store.id)
    .eq('client_mutation_id', normalizedIdempotencyKey)
    .maybeSingle<{ id: string; metadata: Record<string, unknown> | null }>();

  if (existingTransactionError) {
    throw new Error('Unable to verify receipt confirm idempotency.');
  }

  if (existingTransaction) {
    const metadata = existingTransaction.metadata ?? {};
    return {
      receiptId,
      status: 'COMMITTED',
      transactionId: existingTransaction.id,
      appliedItems: Number(metadata.appliedItems ?? 0),
      skippedItems: Number(metadata.skippedItems ?? 0),
      aliasesSaved: Number(metadata.aliasesSaved ?? 0),
      createdItems: Number(metadata.createdItems ?? 0),
    };
  }

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventory_items')
    .select('id, store_id, name, aliases, unit, cost, price, current_stock, low_stock_threshold, is_active, archived_at, updated_at')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .is('archived_at', null);

  if (inventoryError) {
    throw new Error('Unable to load store inventory for receipt confirm.');
  }

  const inventoryById = new Map((inventoryRows ?? []).map((row) => [row.id, row]));
  const inventoryByName = new Map(
    (inventoryRows ?? []).map((row) => [row.name.trim().toLowerCase(), row]),
  );

  let appliedItems = 0;
  let skippedItems = 0;
  let aliasesSaved = 0;
  let createdItems = 0;

  const nowIso = new Date().toISOString();
  const transactionMetadata = {
    source: 'receipt_confirm',
    receiptId,
    appliedItems: 0,
    skippedItems: 0,
    aliasesSaved: 0,
    createdItems: 0,
  };
  const { data: createdTransaction, error: createTransactionError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      created_by: ownerId,
      client_mutation_id: normalizedIdempotencyKey,
      source: 'manual',
      raw_text: `receipt:${receiptId}`,
      parser_source: 'receipt_confirm',
      sync_status: 'verified',
      is_utang: false,
      occurred_at: nowIso,
      synced_at: nowIso,
      verified_at: nowIso,
      metadata: transactionMetadata,
    })
    .select('id')
    .single<{ id: string }>();

  if (createTransactionError || !createdTransaction) {
    throw new Error('Unable to create receipt confirm transaction.');
  }

  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];

    if (item.action === 'SKIP') {
      skippedItems += 1;
      continue;
    }

    let inventoryItem: ReceiptInventoryWriteRecord | null = null;

    if (item.action === 'MATCH_EXISTING') {
      inventoryItem = inventoryById.get(item.productId!.trim()) ?? null;
      if (!inventoryItem) {
        throw new Error(`Inventory item not found for receipt line ${item.receiptItemId}.`);
      }
    } else {
      const nextName = item.createProductName!.trim();
      inventoryItem = inventoryByName.get(nextName.toLowerCase()) ?? null;

      if (!inventoryItem) {
        const aliases = mergeInventoryAliases([], [nextName, item.rawName, item.displayName]);
        const { data: createdItem, error: createItemError } = await supabase
          .from('inventory_items')
          .insert({
            store_id: store.id,
            name: nextName,
            aliases,
            unit: 'pcs',
            cost: item.unitCost ?? null,
            price: item.unitCost ?? 0,
            low_stock_threshold: 0,
          })
          .select('id, store_id, name, aliases, unit, cost, price, current_stock, low_stock_threshold, is_active, archived_at, updated_at')
          .single<ReceiptInventoryWriteRecord>();

        if (createItemError || !createdItem) {
          throw new Error(`Unable to create inventory item: ${nextName}.`);
        }

        inventoryItem = createdItem;
        inventoryById.set(createdItem.id, createdItem);
        inventoryByName.set(createdItem.name.trim().toLowerCase(), createdItem);
        createdItems += 1;
      }
    }

    const unitCost =
      typeof item.unitCost === 'number'
        ? Number(item.unitCost.toFixed(2))
        : toFiniteNumber(inventoryItem.cost ?? inventoryItem.price);

    const { data: createdTransactionItem, error: createTransactionItemError } = await supabase
      .from('transaction_items')
      .insert({
        transaction_id: createdTransaction.id,
        store_id: store.id,
        item_id: inventoryItem.id,
        spoken_name: item.displayName?.trim() || item.rawName.trim(),
        quantity_delta: item.quantity,
        unit_price: unitCost,
        item_snapshot: {
          name: inventoryItem.name,
          unit: inventoryItem.unit,
          receipt_item_id: item.receiptItemId,
          receipt_id: receiptId,
        },
      })
      .select('id')
      .single<{ id: string }>();

    if (createTransactionItemError || !createdTransactionItem) {
      throw new Error('Unable to create receipt transaction item.');
    }

    const { error: createMovementError } = await supabase.from('inventory_movements').insert({
      store_id: store.id,
      item_id: inventoryItem.id,
      transaction_id: createdTransaction.id,
      transaction_item_id: createdTransactionItem.id,
      movement_type: 'receipt_import',
      quantity_delta: item.quantity,
      reason: `Receipt confirm ${receiptId}`,
      created_by: ownerId,
      client_mutation_id: `${normalizedIdempotencyKey}:${index}`,
      occurred_at: nowIso,
      metadata: {
        receipt_id: receiptId,
        receipt_item_id: item.receiptItemId,
        action: item.action,
      },
    });

    if (createMovementError) {
      throw new Error('Unable to create receipt inventory movement.');
    }

    const nextAliases = mergeInventoryAliases(inventoryItem.aliases, [
      item.matchedAlias,
      item.rawName,
      item.displayName,
      item.action === 'CREATE_PRODUCT' ? item.createProductName : null,
    ]);
    const previousAliasCount = (inventoryItem.aliases ?? []).length;
    if (nextAliases.length > previousAliasCount) {
      aliasesSaved += nextAliases.length - previousAliasCount;

      const { data: updatedItem, error: updateAliasError } = await supabase
        .from('inventory_items')
        .update({
          aliases: nextAliases,
        })
        .eq('store_id', store.id)
        .eq('id', inventoryItem.id)
        .is('archived_at', null)
        .select('id, store_id, name, aliases, unit, cost, price, current_stock, low_stock_threshold, is_active, archived_at, updated_at')
        .single<ReceiptInventoryWriteRecord>();

      if (updateAliasError || !updatedItem) {
        throw new Error('Unable to save receipt alias learning.');
      }

      inventoryItem = updatedItem;
      inventoryById.set(updatedItem.id, updatedItem);
      inventoryByName.set(updatedItem.name.trim().toLowerCase(), updatedItem);
    }

    appliedItems += 1;
  }

  const { error: finalizeTransactionError } = await supabase
    .from('transactions')
    .update({
      metadata: {
        source: 'receipt_confirm',
        receiptId,
        appliedItems,
        skippedItems,
        aliasesSaved,
        createdItems,
      },
    })
    .eq('store_id', store.id)
    .eq('id', createdTransaction.id);

  if (finalizeTransactionError) {
    throw new Error('Unable to finalize receipt confirm summary.');
  }

  return {
    receiptId,
    status: 'COMMITTED',
    transactionId: createdTransaction.id,
    appliedItems,
    skippedItems,
    aliasesSaved,
    createdItems,
  };
}
