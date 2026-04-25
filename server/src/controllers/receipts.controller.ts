import type { Request, Response } from 'express';

import {
  isValidMatchReceiptInput,
  isValidParseReceiptInput,
  isValidReceiptOcrInput,
  matchReceiptForOwner,
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
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidReceiptOcrInput(req.body)) {
    return res.status(400).json({
      message: 'Invalid receipt OCR payload.',
    });
  }

  const result = await processReceiptOcrForOwner(user.id, req.params.receiptId, req.body);
  return res.status(200).json(result);
}

export async function parseReceipt(
  req: Request<ProcessReceiptOcrParams, unknown, ParseReceiptInput>,
  res: Response,
) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidParseReceiptInput(req.body)) {
    return res.status(400).json({
      message: 'Invalid receipt parse payload.',
    });
  }

  const result = await parseReceiptForOwner(user.id, req.params.receiptId, req.body);
  return res.status(200).json(result);
}

export async function matchReceipt(
  req: Request<ProcessReceiptOcrParams, unknown, MatchReceiptInput>,
  res: Response,
) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  if (!req.params.receiptId?.trim()) {
    return res.status(400).json({
      message: 'receiptId is required.',
    });
  }

  if (!isValidMatchReceiptInput(req.body)) {
    return res.status(400).json({
      message: 'Invalid receipt match payload.',
    });
  }

  const result = await matchReceiptForOwner(user.id, req.params.receiptId, req.body);
  return res.status(200).json(result);
}
