import { Router } from 'express';

import { getCurrentUser } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/require-auth';

export const authRouter = Router();

authRouter.get('/me', requireAuth, getCurrentUser);
