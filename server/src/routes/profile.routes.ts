import { Router } from 'express';

import { clearMyProfileAvatar, getMyProfile, updateMyProfile } from '../controllers/profile.controller';
import { requireAuth } from '../middleware/require-auth';

export const profileRouter = Router();

profileRouter.get('/me', requireAuth, getMyProfile);
profileRouter.patch('/me', requireAuth, updateMyProfile);
profileRouter.delete('/me/avatar', requireAuth, clearMyProfileAvatar);
