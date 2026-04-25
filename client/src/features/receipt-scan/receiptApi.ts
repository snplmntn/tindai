import { getClientEnv } from '@/config/env';

import type { ReceiptOcrBlock, ReceiptOcrImageMeta } from './receiptOcr';
import type { MatchedReceiptItem, ParsedReceiptItem } from './receiptReview';

export type ProcessReceiptOcrRequest = {
  rawText: string;
  ocrBlocks: ReceiptOcrBlock[];
  imageMeta: ReceiptOcrImageMeta;
  provider: 'placeholder' | 'ml_kit';
};

export type ProcessReceiptOcrResponse = {
  receiptId: string;
  status: 'OCR_DONE';
  ocrQuality: 'usable' | 'weak';
  retryRecommended: boolean;
  normalizedText: string;
  rawText: string;
  ocrBlockCount: number;
  imageMeta: ReceiptOcrImageMeta;
};

export type ParseReceiptRequest = {
  rawText: string;
};

export type ParseReceiptResponse = {
  receiptId: string;
  status: 'PARSED';
  merchantName: string | null;
  receiptDate: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: ParsedReceiptItem[];
};

export type MatchReceiptRequest = {
  items: ParsedReceiptItem[];
};

export type MatchReceiptResponse = {
  receiptId: string;
  status: 'MATCHED';
  items: MatchedReceiptItem[];
};

type ErrorResponse = {
  message?: string;
};

export async function sendReceiptOcrToBackend(params: {
  accessToken: string;
  receiptId: string;
  payload: ProcessReceiptOcrRequest;
}): Promise<ProcessReceiptOcrResponse> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/receipts/${params.receiptId}/process-ocr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.payload),
  });

  const body = (await response.json().catch(() => null)) as ProcessReceiptOcrResponse | ErrorResponse | null;
  if (!response.ok || !body || !('receiptId' in body)) {
    throw new Error((body as ErrorResponse | null)?.message ?? 'Hindi naipadala ang nabasang laman ng resibo.');
  }

  return body;
}

export async function parseReceiptOnBackend(params: {
  accessToken: string;
  receiptId: string;
  payload: ParseReceiptRequest;
}): Promise<ParseReceiptResponse> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/receipts/${params.receiptId}/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.payload),
  });

  const body = (await response.json().catch(() => null)) as ParseReceiptResponse | ErrorResponse | null;
  if (!response.ok || !body || !('receiptId' in body)) {
    throw new Error((body as ErrorResponse | null)?.message ?? 'Hindi maihanda ang detalye ng resibo.');
  }

  return body;
}

export async function matchReceiptOnBackend(params: {
  accessToken: string;
  receiptId: string;
  payload: MatchReceiptRequest;
}): Promise<MatchReceiptResponse> {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/receipts/${params.receiptId}/match`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.payload),
  });

  const body = (await response.json().catch(() => null)) as MatchReceiptResponse | ErrorResponse | null;
  if (!response.ok || !body || !('receiptId' in body)) {
    throw new Error((body as ErrorResponse | null)?.message ?? 'Hindi mahanapan ng tugma ang mga item sa resibo.');
  }

  return body;
}
