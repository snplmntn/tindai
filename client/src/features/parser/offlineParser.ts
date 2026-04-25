import type { LocalInventoryItem } from '@/features/local-db/types';

export type ParserIntent = 'sale' | 'restock' | 'utang' | 'question' | 'unknown';
export type ParserStatus = 'ready_to_apply' | 'needs_confirmation' | 'unparsed';

export type ParserItem = {
  item_id: string;
  item_name: string;
  matched_alias: string;
  quantity: number;
  quantity_delta: number;
  unit: string;
  confidence: number;
};

export type ParserCredit = {
  is_utang: boolean;
  customer_id?: string;
  customer_name?: string;
};

export type ParserResult = {
  raw_text: string;
  normalized_text: string;
  intent: ParserIntent;
  confidence: number;
  status: ParserStatus;
  items: ParserItem[];
  credit: ParserCredit;
  notes: string[];
};

const NUMBER_WORDS: Record<string, number> = {
  isa: 1,
  isang: 1,
  uno: 1,
  usa: 1,
  usaka: 1,
  one: 1,
  dalawa: 2,
  dalawang: 2,
  dos: 2,
  duha: 2,
  duhaka: 2,
  two: 2,
  tatlo: 3,
  tatlong: 3,
  tres: 3,
  tulo: 3,
  tuloka: 3,
  three: 3,
  apat: 4,
  'apat na': 4,
  kwatro: 4,
  upat: 4,
  'upat ka': 4,
  four: 4,
  lima: 5,
  limang: 5,
  singko: 5,
  'lima ka': 5,
  five: 5,
  unom: 6,
  six: 6,
  pito: 7,
  seven: 7,
  walo: 8,
  eight: 8,
  siyam: 9,
  nine: 9,
  napulo: 10,
  ten: 10,
  onse: 11,
  eleven: 11,
  dose: 12,
  twelve: 12,
  trese: 13,
  thirteen: 13,
  katorse: 14,
  fourteen: 14,
  kinse: 15,
  fifteen: 15,
  disais: 16,
  sixteen: 16,
  disisiete: 17,
  seventeen: 17,
  disiotso: 18,
  eighteen: 18,
  disinuebe: 19,
  nineteen: 19,
  baynte: 20,
  twenty: 20,
};

const SALE_TERMS = ['nakabenta', 'nabenta', 'bawas', 'sold', 'sell', 'baligya', 'nabaligya', 'gibaligya'];
const RESTOCK_TERMS = ['dagdag', 'nadagdagan', 'restock', 'refill', 'add', 'dugang', 'idugang', 'puni'];
const UTANG_TERMS = ['utang', 'giutang', 'lista', 'ilista', 'kumuha', 'lista sa utang', 'isulat sa utang'];
const QUESTION_TERMS = ['ano', 'sino', 'ilan', 'magkano', 'low stock', 'unsa'];

export function parseOfflineCommand(rawText: string, inventoryItems: LocalInventoryItem[]): ParserResult {
  const normalizedText = normalizeText(rawText);
  const questionConfidence = getQuestionConfidence(normalizedText);

  if (questionConfidence >= 0.6 && !hasInventoryMutationTerm(normalizedText)) {
    return buildResult(rawText, normalizedText, 'question', questionConfidence, [], { is_utang: false }, [
      'online_required',
      'read_only',
    ]);
  }

  const isUtang = containsAnyTerm(normalizedText, UTANG_TERMS);
  const intent = inferMutationIntent(normalizedText, isUtang);
  const matchedItems = matchInventoryItems(normalizedText, inventoryItems, intent);

  if (intent === 'unknown' || matchedItems.length === 0) {
    return buildResult(rawText, normalizedText, 'unknown', matchedItems.length > 0 ? 0.55 : 0.25, [], { is_utang: false }, [
      'no_inventory_match',
    ]);
  }

  const notes: string[] = [];
  const customerName = isUtang ? extractCustomerName(rawText) : undefined;
  let confidence = Math.min(
    0.99,
    0.55 + (intent === 'utang' ? 0.15 : 0.2) + Math.max(...matchedItems.map((item) => item.confidence)) * 0.25,
  );
  const credit = isUtang
    ? customerName
      ? {
          is_utang: true,
          customer_name: customerName,
        }
      : { is_utang: true }
    : { is_utang: false };

  if (isUtang && !customerName) {
    confidence = Math.min(confidence, 0.84);
    notes.push('missing_customer_name');
  }

  return buildResult(rawText, normalizedText, intent, confidence, matchedItems, credit, notes);
}

function buildResult(
  rawText: string,
  normalizedText: string,
  intent: ParserIntent,
  confidence: number,
  items: ParserItem[],
  credit: ParserCredit,
  notes: string[],
): ParserResult {
  return {
    raw_text: rawText,
    normalized_text: normalizedText,
    intent,
    confidence,
    status: getStatus(confidence),
    items,
    credit,
    notes,
  };
}

function getStatus(confidence: number): ParserStatus {
  if (confidence >= 0.85) {
    return 'ready_to_apply';
  }

  if (confidence >= 0.6) {
    return 'needs_confirmation';
  }

  return 'unparsed';
}

function normalizeText(text: string) {
  let normalized = text
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [word, value] of Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g'), String(value));
  }

  return normalized;
}

function inferMutationIntent(normalizedText: string, isUtang: boolean): ParserIntent {
  if (isUtang) {
    return 'utang';
  }

  if (containsAnyTerm(normalizedText, RESTOCK_TERMS)) {
    return 'restock';
  }

  if (containsAnyTerm(normalizedText, SALE_TERMS)) {
    return 'sale';
  }

  return 'unknown';
}

function hasInventoryMutationTerm(normalizedText: string) {
  return containsAnyTerm(normalizedText, [...SALE_TERMS, ...RESTOCK_TERMS, ...UTANG_TERMS]);
}

function getQuestionConfidence(normalizedText: string) {
  if (normalizedText.includes('low stock')) {
    return 0.8;
  }

  return containsAnyTerm(normalizedText, QUESTION_TERMS) ? 0.65 : 0;
}

function matchInventoryItems(
  normalizedText: string,
  inventoryItems: LocalInventoryItem[],
  intent: ParserIntent,
): ParserItem[] {
  const direction = intent === 'restock' ? 1 : -1;

  return inventoryItems
    .map((item) => {
      const aliases = [item.name, ...item.aliases].map(normalizeText).sort((a, b) => b.length - a.length);
      const matchedAlias = aliases.find((alias) => containsTerm(normalizedText, alias));

      if (!matchedAlias) {
        return null;
      }

      const quantity = extractQuantityBeforeAlias(normalizedText, matchedAlias) ?? 1;

      return {
        item_id: item.id,
        item_name: item.name,
        matched_alias: matchedAlias,
        quantity,
        quantity_delta: direction * quantity,
        unit: item.unit,
        confidence: matchedAlias === normalizeText(item.name) ? 0.95 : 0.9,
      } satisfies ParserItem;
    })
    .filter((item): item is ParserItem => item !== null);
}

function extractQuantityBeforeAlias(normalizedText: string, alias: string) {
  const aliasIndex = normalizedText.indexOf(alias);
  const beforeAlias = normalizedText.slice(0, aliasIndex).trim();
  const numbers = beforeAlias.match(/\b\d+(?:\.\d+)?\b/g);
  const lastNumber = numbers?.at(-1);

  return lastNumber ? Number(lastNumber) : null;
}

function extractCustomerName(rawText: string) {
  const siMatch = rawText.match(/\bsi\s+(.+?)(?=\s+(?:ng|ug|og)\b|[.,]|$)/i);

  if (siMatch?.[1]) {
    return cleanupName(siMatch[1]);
  }

  const niMatch = rawText.match(/\bni\s+(.+?)(?:\.|,|\s+ang\s+\d+|\s+\d+\s+ka|$)/i);

  return niMatch?.[1] ? cleanupName(niMatch[1]) : undefined;
}

function cleanupName(name: string) {
  return name
    .replace(/\s+(?:ang|ug|og)\s+\d+.*$/i, '')
    .replace(/\s+\d+\s+ka.*$/i, '')
    .replace(/\b(ilista|lista|muna|utang|giutang)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => containsTerm(text, term));
}

function containsTerm(text: string, term: string) {
  const normalizedTerm = normalizeText(term);
  const normalizedText = normalizeText(text);
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(?=\\s|$)`);

  return pattern.test(normalizedText);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
