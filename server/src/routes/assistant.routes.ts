import { Router } from 'express';

import { queryAssistant } from '../controllers/assistant.controller';
import { requireAuth } from '../middleware/require-auth';

export const assistantRouter = Router();

assistantRouter.post('/assistant/query', requireAuth, queryAssistant);
