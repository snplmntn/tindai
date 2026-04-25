import { Router } from 'express';

import { getMyAnalyticsSummary } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/require-auth';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', requireAuth, getMyAnalyticsSummary);
