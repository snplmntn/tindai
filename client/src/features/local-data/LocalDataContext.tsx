import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type * as SQLite from 'expo-sqlite';

import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { bootstrapLocalData } from '@/features/bootstrap/bootstrapLocalData';
import { RemoteDataSource } from '@/features/bootstrap/remoteDataSource';
import { handleLocalCommand, type LocalCommandResult } from '@/features/commands/localCommandService';
import { LocalLedgerService } from '@/features/ledger/localLedgerService';
import { getLocalDatabase } from '@/features/local-db/database';
import { runLocalMigrations } from '@/features/local-db/migrations';
import { InventoryRepository, StoreRepository } from '@/features/local-db/repositories';
import type { LocalInventoryItem, LocalStore } from '@/features/local-db/types';

type LocalDataState = {
  store: LocalStore | null;
  inventoryItems: LocalInventoryItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  submitLocalCommand: (rawText: string) => Promise<LocalCommandResult>;
};

const LocalDataContext = createContext<LocalDataState | undefined>(undefined);

async function createRepositories() {
  const database = await getLocalDatabase();
  await runLocalMigrations(database);

  return {
    database,
    storeRepository: new StoreRepository(database),
    inventoryRepository: new InventoryRepository(database),
  };
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [store, setStore] = useState<LocalStore | null>(null);
  const [inventoryItems, setInventoryItems] = useState<LocalInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCachedData = useCallback(async () => {
    const { storeRepository, inventoryRepository } = await createRepositories();
    const cachedStore = await storeRepository.getLatestStore();

    setStore(cachedStore);
    setInventoryItems(cachedStore ? await inventoryRepository.listInventoryForStore(cachedStore.id) : []);

    return {
      storeRepository,
      inventoryRepository,
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setStore(null);
      setInventoryItems([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { storeRepository, inventoryRepository } = await loadCachedData();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        return;
      }

      const result = await bootstrapLocalData({
        storeRepository,
        inventoryRepository,
        remoteDataSource: new RemoteDataSource(accessToken),
      });

      const refreshedStore = await storeRepository.getLatestStore();
      setStore(refreshedStore);
      setInventoryItems(await inventoryRepository.listInventoryForStore(result.storeId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load local data.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadCachedData]);

  const submitLocalCommand = useCallback(
    async (rawText: string) => {
      const commandText = rawText.trim();

      if (!commandText) {
        throw new Error('Enter a command first.');
      }

      if (!store) {
        throw new Error('No local store is available.');
      }

      const { database, inventoryRepository } = await createRepositories();
      const latestInventoryItems = await inventoryRepository.listInventoryForStore(store.id);
      const result = await handleLocalCommand({
        rawText: commandText,
        storeId: store.id,
        inventoryItems: latestInventoryItems,
        ledgerService: new LocalLedgerService({
          runAsync: (source, params = []) => database.runAsync(source, params as SQLite.SQLiteBindParams),
          getFirstAsync: (source, params = []) => database.getFirstAsync(source, params as SQLite.SQLiteBindParams),
        }),
      });

      if (result.status === 'applied') {
        setInventoryItems(await inventoryRepository.listInventoryForStore(store.id));
      }

      return result;
    },
    [store],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      store,
      inventoryItems,
      isLoading,
      error,
      refresh,
      submitLocalCommand,
    }),
    [error, inventoryItems, isLoading, refresh, store, submitLocalCommand],
  );

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData() {
  const context = useContext(LocalDataContext);

  if (!context) {
    throw new Error('useLocalData must be used within a LocalDataProvider');
  }

  return context;
}
