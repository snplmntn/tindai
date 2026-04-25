import { getClientEnv } from '@/config/env';

import type { ReceiptOcrBlock, ReceiptOcrImageMeta } from './receiptOcr';

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
