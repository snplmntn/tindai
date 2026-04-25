import type { Request, Response } from 'express';

import { getAnalyticsSummaryForOwner } from '../models/analytics.model';

export async function getMyAnalyticsSummary(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const analytics = await getAnalyticsSummaryForOwner(user.id);
  return res.status(200).json({
    analytics,
  });
}
