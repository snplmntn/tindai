import { Router } from 'express';

import {
  archiveInventoryItem,
  createInventoryItem,
  getInventoryItem,
  listInventoryItems,
  updateInventoryItem,
} from '../controllers/inventory.controller';
import { requireAuth } from '../middleware/require-auth';

export const inventoryRouter = Router();

inventoryRouter.get('/inventory/items', requireAuth, listInventoryItems);
inventoryRouter.get('/inventory/items/:itemId', requireAuth, getInventoryItem);
inventoryRouter.post('/inventory/items', requireAuth, createInventoryItem);
inventoryRouter.patch('/inventory/items/:itemId', requireAuth, updateInventoryItem);
inventoryRouter.post('/inventory/items/:itemId/archive', requireAuth, archiveInventoryItem);
