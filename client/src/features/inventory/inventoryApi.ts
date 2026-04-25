import { getClientEnv } from '@/config/env';

export type RemoteInventoryItem = {
  id: string;
  name: string;
  aliases: string[];
  unit: string;
  cost: number | null;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
  updatedAt: string;
  isLowStock: boolean;
};

export type InventoryMutationInput = {
  name?: string;
  aliases?: string[];
  unit?: string;
  cost?: number | null;
  price?: number;
  lowStockThreshold?: number;
};

type InventoryItemResponse = {
  item?: RemoteInventoryItem;
  message?: string;
};

async function requestInventoryItem(
  accessToken: string,
  path: string,
  init?: {
    method?: 'POST' | 'PATCH';
    body?: InventoryMutationInput;
  },
) {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}${path}`, {
    method: init?.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : undefined),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : undefined),
  });

  const payload = (await response.json().catch(() => null)) as InventoryItemResponse | null;
  if (!response.ok || !payload?.item) {
    throw new Error(payload?.message ?? 'Hindi ma-save ang item ngayon. Subukan ulit.');
  }

  return payload.item;
}

export async function createInventoryItem(accessToken: string, input: InventoryMutationInput) {
  return requestInventoryItem(accessToken, '/api/v1/inventory/items', {
    method: 'POST',
    body: input,
  });
}

export async function updateInventoryItem(accessToken: string, itemId: string, input: InventoryMutationInput) {
  return requestInventoryItem(accessToken, `/api/v1/inventory/items/${itemId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function archiveInventoryItem(accessToken: string, itemId: string) {
  return requestInventoryItem(accessToken, `/api/v1/inventory/items/${itemId}/archive`, {
    method: 'POST',
  });
}
