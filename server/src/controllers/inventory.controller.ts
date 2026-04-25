import type { Request, Response } from 'express';

import {
  archiveInventoryItemForOwner,
  createInventoryItemForOwner,
  getInventoryItemForOwner,
  InventoryModelError,
  listInventoryItemsForOwner,
  type InventoryMutationInput,
  type InventorySort,
  updateInventoryItemForOwner,
} from '../models/inventory.model';

type InventoryListQuery = {
  search?: unknown;
  sort?: unknown;
  lowStockOnly?: unknown;
};

type InventoryMutationBody = Record<string, unknown> | null | undefined;

const allowedSorts: InventorySort[] = ['name', 'stock_desc', 'stock_asc'];

function hasBalanceFields(value: InventoryMutationBody) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const keys = ['quantity', 'currentStock', 'current_stock', 'openingStock', 'opening_stock'];
  return keys.some((key) => key in value);
}

function parseOptionalNonNegativeNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return { ok: true as const, value: undefined };
  }

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false as const, message: `${fieldName} must be a non-negative number.` };
  }

  return { ok: true as const, value: parsed };
}

function parseAliases(value: unknown) {
  if (value === undefined) {
    return { ok: true as const, value: undefined };
  }

  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    return { ok: false as const, message: 'aliases must be an array of strings.' };
  }

  return { ok: true as const, value };
}

function parseCreateOrUpdatePayload(body: InventoryMutationBody, mode: 'create' | 'update') {
  if (!body || typeof body !== 'object') {
    return { ok: false as const, status: 400, message: 'Invalid inventory payload.' };
  }

  if (hasBalanceFields(body)) {
    return { ok: false as const, status: 400, message: 'Stock values must go through the normal sync flow.' };
  }

  const payload: InventoryMutationInput = {};
  let providedFields = 0;

  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return { ok: false as const, status: 400, message: 'name is required.' };
    }

    payload.name = body.name.trim();
    providedFields += 1;
  } else if (mode === 'create') {
    return { ok: false as const, status: 400, message: 'name is required.' };
  }

  const aliasesResult = parseAliases(body.aliases);
  if (!aliasesResult.ok) {
    return { ok: false as const, status: 400, message: aliasesResult.message };
  }
  if (aliasesResult.value !== undefined) {
    payload.aliases = aliasesResult.value;
    providedFields += 1;
  }

  if ('unit' in body) {
    if (typeof body.unit !== 'string' || !body.unit.trim()) {
      return { ok: false as const, status: 400, message: 'unit must be a non-empty string.' };
    }

    payload.unit = body.unit.trim();
    providedFields += 1;
  }

  const costResult = parseOptionalNonNegativeNumber(body.cost, 'cost');
  if (!costResult.ok) {
    return { ok: false as const, status: 400, message: costResult.message };
  }
  if (costResult.value !== undefined) {
    payload.cost = costResult.value;
    providedFields += 1;
  }

  const priceResult = parseOptionalNonNegativeNumber(body.price, 'price');
  if (!priceResult.ok) {
    return { ok: false as const, status: 400, message: priceResult.message };
  }
  if (priceResult.value !== undefined) {
    payload.price = priceResult.value;
    providedFields += 1;
  }

  const thresholdResult = parseOptionalNonNegativeNumber(body.lowStockThreshold, 'lowStockThreshold');
  if (!thresholdResult.ok) {
    return { ok: false as const, status: 400, message: thresholdResult.message };
  }
  if (thresholdResult.value !== undefined) {
    payload.lowStockThreshold = thresholdResult.value;
    providedFields += 1;
  }

  if (mode === 'update' && providedFields === 0) {
    return { ok: false as const, status: 400, message: 'At least one inventory field is required.' };
  }

  return { ok: true as const, payload };
}

function handleInventoryError(error: unknown, res: Response) {
  if (error instanceof InventoryModelError) {
    return res.status(error.status).json({
      message: error.message,
    });
  }

  throw error;
}

export async function listInventoryItems(req: Request<unknown, unknown, unknown, InventoryListQuery>, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const rawSearch = req.query.search;
  const rawSort = req.query.sort;
  const rawLowStockOnly = req.query.lowStockOnly;

  if (rawSearch !== undefined && typeof rawSearch !== 'string') {
    return res.status(400).json({
      message: 'search must be a string.',
    });
  }

  if (rawSort !== undefined && (typeof rawSort !== 'string' || !allowedSorts.includes(rawSort as InventorySort))) {
    return res.status(400).json({
      message: 'sort must be one of: name, stock_desc, stock_asc.',
    });
  }

  if (
    rawLowStockOnly !== undefined &&
    (typeof rawLowStockOnly !== 'string' || !['true', 'false'].includes(rawLowStockOnly))
  ) {
    return res.status(400).json({
      message: 'lowStockOnly must be true or false.',
    });
  }

  try {
    const items = await listInventoryItemsForOwner(user.id, {
      search: rawSearch?.trim() || undefined,
      sort: (rawSort as InventorySort | undefined) ?? 'name',
      lowStockOnly: rawLowStockOnly === 'true',
    });

    return res.status(200).json({
      items,
    });
  } catch (error) {
    return handleInventoryError(error, res);
  }
}

export async function getInventoryItem(req: Request<{ itemId: string }>, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  try {
    const item = await getInventoryItemForOwner(user.id, req.params.itemId);
    return res.status(200).json({
      item,
    });
  } catch (error) {
    return handleInventoryError(error, res);
  }
}

export async function createInventoryItem(req: Request<unknown, unknown, InventoryMutationBody>, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const payloadResult = parseCreateOrUpdatePayload(req.body, 'create');
  if (!payloadResult.ok) {
    return res.status(payloadResult.status).json({
      message: payloadResult.message,
    });
  }

  try {
    const item = await createInventoryItemForOwner(user.id, payloadResult.payload);
    return res.status(201).json({
      item,
    });
  } catch (error) {
    return handleInventoryError(error, res);
  }
}

export async function updateInventoryItem(req: Request<{ itemId: string }, unknown, InventoryMutationBody>, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const payloadResult = parseCreateOrUpdatePayload(req.body, 'update');
  if (!payloadResult.ok) {
    return res.status(payloadResult.status).json({
      message: payloadResult.message,
    });
  }

  try {
    const item = await updateInventoryItemForOwner(user.id, req.params.itemId, payloadResult.payload);
    return res.status(200).json({
      item,
    });
  } catch (error) {
    return handleInventoryError(error, res);
  }
}

export async function archiveInventoryItem(req: Request<{ itemId: string }>, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  try {
    const item = await archiveInventoryItemForOwner(user.id, req.params.itemId);
    return res.status(200).json({
      item,
    });
  } catch (error) {
    return handleInventoryError(error, res);
  }
}
