import type { Request, Response } from 'express';

import { createStoreByOwnerId, getStoreByOwnerId, updateStoreNameByOwnerId } from '../models/store.model';

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

type UpdateMyStoreBody = {
  name?: unknown;
};

export async function updateMyStore(req: Request<unknown, unknown, UpdateMyStoreBody>, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const rawName = req.body?.name;
  if (typeof rawName !== 'string') {
    return res.status(400).json({
      message: 'Store name is required.',
    });
  }

  const name = rawName.trim();
  if (!name) {
    return res.status(400).json({
      message: 'Store name cannot be empty.',
    });
  }

  const store = await updateStoreNameByOwnerId(user.id, name);

  if (!store) {
    return res.status(404).json({
      message: 'Store not found.',
    });
  }

  return res.status(200).json({
    store,
  });
}

function resolveInitialStoreName(user: NonNullable<Request['user']>) {
  const storeName = user.userMetadata.store_name;
  if (typeof storeName === 'string' && storeName.trim()) {
    return storeName.trim();
  }

  return 'My Store';
}

export async function bootstrapMyStore(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const existingStore = await getStoreByOwnerId(user.id);
  if (existingStore) {
    return res.status(200).json({
      store: existingStore,
      created: false,
    });
  }

  const createdStore = await createStoreByOwnerId(user.id, resolveInitialStoreName(user));

  if (!createdStore) {
    return res.status(500).json({
      message: 'Unable to bootstrap store.',
    });
  }

  return res.status(200).json({
    store: createdStore,
    created: true,
  });
}
