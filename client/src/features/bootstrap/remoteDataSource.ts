import { getClientEnv } from '@/config/env';
import type { LocalInventoryItem, LocalStore } from '@/features/local-db/types';

type StoreResponse = {
  store: LocalStore;
};

type InventoryResponse = {
  items?: InventoryRecord[];
  message?: string;
};

type InventoryRecord = {
  id: string;
  name: string;
  aliases: string[];
  unit: string;
  cost: number | null;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
  updatedAt: string;
};

export class RemoteDataSource {
  constructor(private readonly accessToken: string) {}

  private async requestStore(path: '/api/v1/store/me' | '/api/v1/store/bootstrap', method: 'GET' | 'POST') {
    const env = getClientEnv();
    return fetch(`${env.EXPO_PUBLIC_API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  private async requestInventory(path: '/api/v1/inventory/items') {
    const env = getClientEnv();
    return fetch(`${env.EXPO_PUBLIC_API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  async getCurrentStore(): Promise<LocalStore> {
    const response = await this.requestStore('/api/v1/store/me', 'GET');
    if (response.ok) {
      const payload = (await response.json()) as StoreResponse;
      return payload.store;
    }

    if (response.status === 404) {
      const bootstrapResponse = await this.requestStore('/api/v1/store/bootstrap', 'POST');
      if (bootstrapResponse.ok) {
        const payload = (await bootstrapResponse.json()) as StoreResponse;
        return payload.store;
      }
    }

    throw new Error('Unable to load authenticated store.');
  }

  async getInventoryItems(storeId: string): Promise<LocalInventoryItem[]> {
    const response = await this.requestInventory('/api/v1/inventory/items');
    const payload = (await response.json().catch(() => null)) as InventoryResponse | null;

    if (!response.ok || !payload?.items) {
      throw new Error(payload?.message ?? 'Unable to load inventory snapshot.');
    }

    return payload.items.map((item) => ({
      id: item.id,
      storeId,
      name: item.name,
      aliases: item.aliases,
      unit: item.unit,
      cost: item.cost,
      price: Number(item.price),
      currentStock: Number(item.currentStock),
      lowStockThreshold: Number(item.lowStockThreshold),
      updatedAt: item.updatedAt,
    }));
  }
}
