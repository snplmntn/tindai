import { Router } from 'express';

import { parseReceipt, processReceiptOcr } from '../controllers/receipts.controller';
import { requireAuth } from '../middleware/require-auth';

export const receiptsRouter = Router();

receiptsRouter.post('/receipts/:receiptId/process-ocr', requireAuth, processReceiptOcr);
receiptsRouter.post('/receipts/:receiptId/parse', requireAuth, parseReceipt);
