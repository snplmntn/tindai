import { Router } from 'express';

import { bootstrapMyStore, getMyStore, updateMyStore } from '../controllers/store.controller';
import { requireAuth } from '../middleware/require-auth';

export const storeRouter = Router();

storeRouter.get('/me', requireAuth, getMyStore);
storeRouter.post('/bootstrap', requireAuth, bootstrapMyStore);
storeRouter.patch('/me', requireAuth, updateMyStore);
