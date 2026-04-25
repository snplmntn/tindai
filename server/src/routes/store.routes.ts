import { Router } from 'express';

import { getMyStore } from '../controllers/store.controller';
import { requireAuth } from '../middleware/require-auth';

export const storeRouter = Router();

storeRouter.get('/me', requireAuth, getMyStore);
