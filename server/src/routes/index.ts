import { Router } from 'express';

import { authRouter } from './auth.routes';
import { profileRouter } from './profile.routes';
import { storeRouter } from './store.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/store', storeRouter);
