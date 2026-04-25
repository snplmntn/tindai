import { Router } from 'express';

import { assistantRouter } from './assistant.routes';
import { analyticsRouter } from './analytics.routes';
import { authRouter } from './auth.routes';
import { profileRouter } from './profile.routes';
import { storeRouter } from './store.routes';
import { syncRouter } from './sync.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/store', storeRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/', assistantRouter);
apiRouter.use('/', syncRouter);
