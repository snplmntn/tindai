import type { LocalInventoryItem } from '@/features/local-db/types';

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

export type MatchedReceiptItem = {
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
  matchStatus: 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'UNMATCHED';
  matchScore: number | null;
  suggestedProductId: string | null;
  suggestedProductName: string | null;
  suggestedProductSku: string | null;
  matchedAlias: string | null;
};

export type ReceiptReviewItemDraft = {
  receiptItemId: string;
  rawName: string;
  displayName: string;
  normalizedName: string;
  quantityText: string;
  unitPriceText: string;
  lineTotalText: string;
  parserConfidence: number | null;
  nameSource: 'ocr' | 'gemini';
  nameConfidence: number | null;
  matchStatus: 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'UNMATCHED';
  matchScore: number | null;
  selectedProductId: string | null;
  selectedProductName: string | null;
  selectedProductSku: string | null;
  matchedAlias: string | null;
  resolution: 'MATCH_EXISTING' | 'CREATE_PRODUCT' | 'SKIP' | 'UNRESOLVED';
  newProductName: string;
  isMatchPickerOpen: boolean;
  isCreateProductOpen: boolean;
  matchSearchText: string;
};

export type ReceiptReviewSession = {
  receiptId: string;
  merchantName: string | null;
  receiptDate: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: ReceiptReviewItemDraft[];
};

function formatDecimal(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}` : '';
}

function deriveInitialResolution(item: MatchedReceiptItem): ReceiptReviewItemDraft['resolution'] {
  if (item.matchStatus === 'HIGH_CONFIDENCE' && item.suggestedProductId) {
    return 'MATCH_EXISTING';
  }

  return 'UNRESOLVED';
}

export function createReceiptReviewSession(params: {
  receiptId: string;
  merchantName: string | null;
  receiptDate: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: MatchedReceiptItem[];
}): ReceiptReviewSession {
  return {
    receiptId: params.receiptId,
    merchantName: params.merchantName,
    receiptDate: params.receiptDate,
    subtotalAmount: params.subtotalAmount,
    taxAmount: params.taxAmount,
    totalAmount: params.totalAmount,
    items: params.items.map((item) => ({
      receiptItemId: item.receiptItemId,
      rawName: item.rawName,
      displayName: item.displayName,
      normalizedName: item.normalizedName,
      quantityText: formatDecimal(item.quantity ?? 1),
      unitPriceText: formatDecimal(item.unitPrice),
      lineTotalText: formatDecimal(item.lineTotal),
      parserConfidence: item.parserConfidence,
      nameSource: item.nameSource,
      nameConfidence: item.nameConfidence,
      matchStatus: item.matchStatus,
      matchScore: item.matchScore,
      selectedProductId: item.suggestedProductId,
      selectedProductName: item.suggestedProductName,
      selectedProductSku: item.suggestedProductSku,
      matchedAlias: item.matchedAlias,
      resolution: deriveInitialResolution(item),
      newProductName: item.displayName,
      isMatchPickerOpen: false,
      isCreateProductOpen: false,
      matchSearchText: '',
    })),
  };
}

export function getReceiptReviewSummary(items: ReceiptReviewItemDraft[]) {
  const skippedCount = items.filter((item) => item.resolution === 'SKIP').length;
  const createCount = items.filter((item) => item.resolution === 'CREATE_PRODUCT').length;
  const matchedCount = items.filter((item) => item.resolution === 'MATCH_EXISTING').length;
  const unresolvedCount = items.filter((item) => item.resolution === 'UNRESOLVED').length;

  return {
    skippedCount,
    createCount,
    matchedCount,
    unresolvedCount,
  };
}

export function filterInventoryMatches(inventoryItems: LocalInventoryItem[], searchText: string) {
  const normalizedQuery = searchText.trim().toLowerCase();
  const ranked = inventoryItems.filter((item) => {
    if (!normalizedQuery) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(normalizedQuery))
    );
  });

  return ranked.slice(0, 6);
}
