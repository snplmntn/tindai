import { getClientEnv } from '@/config/env';
import { supabase } from '@/config/supabase';
import type { LocalInventoryItem, LocalStore } from '@/features/local-db/types';

type StoreResponse = {
  store: LocalStore;
};

type InventoryRecord = {
  id: string;
  store_id: string;
  name: string;
  aliases: string[] | null;
  unit: string;
  price: number;
  current_stock: number;
  low_stock_threshold: number;
  updated_at: string;
};

export class RemoteDataSource {
  constructor(private readonly accessToken: string) {}

  async getCurrentStore(): Promise<LocalStore> {
    const env = getClientEnv();
    const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/store/me`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load authenticated store.');
    }

    const payload = (await response.json()) as StoreResponse;
    return payload.store;
  }

  async getInventoryItems(storeId: string): Promise<LocalInventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, store_id, name, aliases, unit, price, current_stock, low_stock_threshold, updated_at')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .is('archived_at', null)
      .order('name', { ascending: true })
      .returns<InventoryRecord[]>();

    if (error) {
      throw new Error('Unable to load inventory snapshot.');
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      storeId: item.store_id,
      name: item.name,
      aliases: item.aliases ?? [],
      unit: item.unit,
      price: Number(item.price),
      currentStock: Number(item.current_stock),
      lowStockThreshold: Number(item.low_stock_threshold),
      updatedAt: item.updated_at,
    }));
  }
}
