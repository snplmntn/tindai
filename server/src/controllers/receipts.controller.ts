import type { Request, Response } from 'express';

import {
  confirmReceiptForOwner,
  isValidConfirmReceiptInput,
  isValidMatchReceiptInput,
  isValidParseReceiptInput,
  isValidReceiptOcrInput,
  matchReceiptForOwner,
  type ConfirmReceiptInput,
  type MatchReceiptInput,
  parseReceiptForOwner,
  type ParseReceiptInput,
  processReceiptOcrForOwner,
  type ProcessReceiptOcrInput,
} from '../models/receipts.model';

type ProcessReceiptOcrParams = {
  receiptId: string;
};

export async function processReceiptOcr(
  req: Request<ProcessReceiptOcrParams, unknown, ProcessReceiptOcrInput>,
  res: Response,
) {
  const startedAt = Date.now();
  const user = req.user;
  if (!user) {
    console.warn(`[receipt] process-ocr unauthorized receiptId=${req.params.receiptId ?? 'missing'}`);
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    console.warn(`[receipt] process-ocr invalid-receipt-id userId=${user.id}`);
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidReceiptOcrInput(req.body)) {
    console.warn(
      `[receipt] process-ocr invalid-payload userId=${user.id} receiptId=${req.params.receiptId}`,
    );
    return res.status(400).json({
      message: 'Invalid receipt OCR payload.',
    });
  }

  console.info(
    `[receipt] process-ocr start userId=${user.id} receiptId=${req.params.receiptId} rawTextLength=${req.body.rawText.length} blocks=${req.body.ocrBlocks.length}`,
  );
  const result = await processReceiptOcrForOwner(user.id, req.params.receiptId, req.body);
  console.info(
    `[receipt] process-ocr ok userId=${user.id} receiptId=${req.params.receiptId} quality=${result.ocrQuality} durationMs=${Date.now() - startedAt}`,
  );
  return res.status(200).json(result);
}

export async function parseReceipt(
  req: Request<ProcessReceiptOcrParams, unknown, ParseReceiptInput>,
  res: Response,
) {
  const startedAt = Date.now();
  const user = req.user;
  if (!user) {
    console.warn(`[receipt] parse unauthorized receiptId=${req.params.receiptId ?? 'missing'}`);
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    console.warn(`[receipt] parse invalid-receipt-id userId=${user.id}`);
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidParseReceiptInput(req.body)) {
    console.warn(
      `[receipt] parse invalid-payload userId=${user.id} receiptId=${req.params.receiptId}`,
    );
    return res.status(400).json({
      message: 'Invalid receipt parse payload.',
    });
  }

  console.info(
    `[receipt] parse start userId=${user.id} receiptId=${req.params.receiptId} rawTextLength=${req.body.rawText.length}`,
  );
  const result = await parseReceiptForOwner(user.id, req.params.receiptId, req.body);
  console.info(
    `[receipt] parse ok userId=${user.id} receiptId=${req.params.receiptId} items=${result.items.length} nameEnrichment=${result.nameEnrichmentStatus} durationMs=${Date.now() - startedAt}`,
  );
  return res.status(200).json(result);
}

export async function matchReceipt(
  req: Request<ProcessReceiptOcrParams, unknown, MatchReceiptInput>,
  res: Response,
) {
  const startedAt = Date.now();
  const user = req.user;
  if (!user) {
    console.warn(`[receipt] match unauthorized receiptId=${req.params.receiptId ?? 'missing'}`);
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    console.warn(`[receipt] match invalid-receipt-id userId=${user.id}`);
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidMatchReceiptInput(req.body)) {
    console.warn(
      `[receipt] match invalid-payload userId=${user.id} receiptId=${req.params.receiptId}`,
    );
    return res.status(400).json({
      message: 'Invalid receipt match payload.',
    });
  }

  console.info(
    `[receipt] match start userId=${user.id} receiptId=${req.params.receiptId} items=${req.body.items.length}`,
  );
  const result = await matchReceiptForOwner(user.id, req.params.receiptId, req.body);
  const highConfidenceCount = result.items.filter((item) => item.matchStatus === 'HIGH_CONFIDENCE').length;
  const needsReviewCount = result.items.filter((item) => item.matchStatus === 'NEEDS_REVIEW').length;
  const unmatchedCount = result.items.filter((item) => item.matchStatus === 'UNMATCHED').length;
  console.info(
    `[receipt] match ok userId=${user.id} receiptId=${req.params.receiptId} high=${highConfidenceCount} review=${needsReviewCount} unmatched=${unmatchedCount} durationMs=${Date.now() - startedAt}`,
  );
  return res.status(200).json(result);
}

export async function confirmReceipt(
  req: Request<ProcessReceiptOcrParams, unknown, ConfirmReceiptInput>,
  res: Response,
) {
  const startedAt = Date.now();
  const user = req.user;
  if (!user) {
    console.warn(`[receipt] confirm unauthorized receiptId=${req.params.receiptId ?? 'missing'}`);
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    console.warn(`[receipt] confirm invalid-receipt-id userId=${user.id}`);
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidConfirmReceiptInput(req.body)) {
    console.warn(
      `[receipt] confirm invalid-payload userId=${user.id} receiptId=${req.params.receiptId}`,
    );
    return res.status(400).json({
      message: 'Invalid receipt confirm payload.',
    });
  }

  const idempotencyKey = req.header('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return res.status(400).json({
      message: 'Idempotency-Key header is required.',
    });
  }

  console.info(
    `[receipt] confirm start userId=${user.id} receiptId=${req.params.receiptId} items=${req.body.items.length}`,
  );
  const result = await confirmReceiptForOwner(user.id, req.params.receiptId, idempotencyKey, req.body);
  console.info(
    `[receipt] confirm ok userId=${user.id} receiptId=${req.params.receiptId} applied=${result.appliedItems} skipped=${result.skippedItems} durationMs=${Date.now() - startedAt}`,
  );
  return res.status(200).json(result);
}
