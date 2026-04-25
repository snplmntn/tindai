import type { LocalInventoryItem, LocalStore } from '@/features/local-db/types';

export type StoreRepositoryPort = {
  upsertStore: (store: LocalStore) => Promise<void>;
};

export type InventoryRepositoryPort = {
  replaceInventoryForStore: (storeId: string, items: LocalInventoryItem[]) => Promise<void>;
};

export type RemoteDataSourcePort = {
  getCurrentStore: () => Promise<LocalStore>;
  getInventoryItems: (storeId: string) => Promise<LocalInventoryItem[]>;
};

export async function bootstrapLocalData({
  storeRepository,
  inventoryRepository,
  remoteDataSource,
}: {
  storeRepository: StoreRepositoryPort;
  inventoryRepository: InventoryRepositoryPort;
  remoteDataSource: RemoteDataSourcePort;
}) {
  const store = await remoteDataSource.getCurrentStore();
  const inventoryItems = await remoteDataSource.getInventoryItems(store.id);

  await storeRepository.upsertStore(store);
  await inventoryRepository.replaceInventoryForStore(store.id, inventoryItems);

  return {
    storeId: store.id,
    inventoryCount: inventoryItems.length,
  };
}
