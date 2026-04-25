import { Router } from 'express';

import { verifyTransactions } from '../controllers/sync.controller';
import { requireAuth } from '../middleware/require-auth';

export const syncRouter = Router();

syncRouter.post('/verify-transactions', requireAuth, verifyTransactions);
