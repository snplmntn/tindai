import { Router } from 'express';

import { exchangeGoogleIdToken, getCurrentUser } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/require-auth';

export const authRouter = Router();

authRouter.post('/google/exchange', exchangeGoogleIdToken);
authRouter.get('/me', requireAuth, getCurrentUser);
