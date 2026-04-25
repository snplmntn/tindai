import { Router } from 'express';

import { confirmReceipt, matchReceipt, parseReceipt, processReceiptOcr } from '../controllers/receipts.controller';
import { requireAuth } from '../middleware/require-auth';

export const receiptsRouter = Router();

receiptsRouter.post('/receipts/:receiptId/process-ocr', requireAuth, processReceiptOcr);
receiptsRouter.post('/receipts/:receiptId/parse', requireAuth, parseReceipt);
receiptsRouter.post('/receipts/:receiptId/match', requireAuth, matchReceipt);
receiptsRouter.post('/receipts/:receiptId/confirm', requireAuth, confirmReceipt);
