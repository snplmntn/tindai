import type { Request, Response } from 'express';

import { getStoreByOwnerId } from '../models/store.model';

export async function getMyStore(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const store = await getStoreByOwnerId(user.id);

  if (!store) {
    return res.status(404).json({
      message: 'Store not found.',
    });
  }

  return res.status(200).json({
    store,
  });
}
