import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type * as SQLite from 'expo-sqlite';

import { getClientEnv } from '@/config/env';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { bootstrapLocalData } from '@/features/bootstrap/bootstrapLocalData';
import { RemoteDataSource } from '@/features/bootstrap/remoteDataSource';
import {
  applyConfirmedParserResult,
  handleLocalCommand,
  type CommandSource,
  type LocalCommandResult,
} from '@/features/commands/localCommandService';
import { LocalLedgerService } from '@/features/ledger/localLedgerService';
import { getLocalDatabase } from '@/features/local-db/database';
import { runLocalMigrations } from '@/features/local-db/migrations';
import {
  AssistantInteractionRepository,
  AppStateRepository,
  CustomerRepository,
  InventoryRepository,
  type PendingTransactionForSync,
  StoreRepository,
  TransactionRepository,
} from '@/features/local-db/repositories';
import type {
  LocalAppState,
  LocalAssistantInteraction,
  LocalCustomer,
  LocalInventoryItem,
  LocalStore,
  LocalTransactionSummary,
} from '@/features/local-db/types';
import type { ParserResult } from '@/features/parser/offlineParser';

type LocalDataState = {
  appState: LocalAppState | null;
  store: LocalStore | null;
  inventoryItems: LocalInventoryItem[];
  customers: LocalCustomer[];
  recentTransactions: LocalTransactionSummary[];
  assistantInteractions: LocalAssistantInteraction[];
  pendingTransactions: LocalTransactionSummary[];
  isLoading: boolean;
  error: string | null;
  syncNotice: string | null;
  refresh: () => Promise<void>;
  submitLocalCommand: (rawText: string, source?: CommandSource) => Promise<LocalCommandResult>;
  confirmLocalCommand: (parserResult: ParserResult, customerName?: string) => Promise<LocalCommandResult>;
  applyManualAdjustment: (itemId: string, direction: -1 | 1) => Promise<void>;
  submitFallbackCommand: (entry: {
    intent: 'sale' | 'restock' | 'utang';
    itemId: string;
    quantity: number;
    customerName?: string;
  }) => Promise<void>;
  createLocalCustomer: (name: string) => Promise<LocalCustomer>;
  submitAssistantQuestion: (questionText: string, inputMode: 'voice' | 'text') => Promise<{
    answerText: string;
    status: 'answered';
  }>;
  renameLocalStore: (name: string) => Promise<void>;
  resolvePendingClaim: (decision: 'claim' | 'discard') => Promise<void>;
};

const LocalDataContext = createContext<LocalDataState | undefined>(undefined);
const LOCAL_REFRESH_TIMEOUT_MS = 12000;
const DEFAULT_SYNC_NOTICE = 'Offline now. Using local records. We will send updates when internet returns.';

async function createRepositories() {
  const database = await getLocalDatabase();
  await runLocalMigrations(database);

  return {
    database,
    appStateRepository: new AppStateRepository(database),
    storeRepository: new StoreRepository(database),
    inventoryRepository: new InventoryRepository(database),
    customerRepository: new CustomerRepository(database),
    transactionRepository: new TransactionRepository(database),
    assistantInteractionRepository: new AssistantInteractionRepository(database),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function createGuestStore(guestDeviceId: string): LocalStore {
  const now = new Date().toISOString();
  return {
    id: `guest-store-${guestDeviceId}`,
    ownerId: guestDeviceId,
    name: 'My Store',
    currencyCode: 'PHP',
    timezone: 'Asia/Manila',
    updatedAt: now,
  };
}

async function uploadPendingTransactions(accessToken: string, pending: PendingTransactionForSync[]) {
  if (pending.length === 0) {
    return [] as Array<{ clientMutationId: string; status: 'synced' | 'needs_review' | 'failed' }>;
  }

  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/verify-transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transactions: pending.map((transaction) => ({
        clientMutationId: transaction.clientMutationId,
        rawText: transaction.rawText,
        source: transaction.source,
        parserSource: transaction.parserSource,
        localParse: transaction.localParse,
        isUtang: transaction.isUtang,
        customerName: transaction.customerName,
        occurredAt: transaction.occurredAt,
        items: transaction.items.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          matchedAlias: item.matchedAlias,
          quantityDelta: item.quantityDelta,
          unitPrice: item.unitPrice,
          unit: item.unit,
        })),
      })),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Unable to upload pending transactions.');
  }

  const payload = (await response.json()) as {
    results: Array<{ clientMutationId: string; status: 'synced' | 'needs_review' | 'failed'; reason?: string }>;
  };
  return payload.results;
}

function isConnectivityIssue(caughtError: unknown): boolean {
  if (!(caughtError instanceof Error)) {
    return false;
  }

  const message = caughtError.message.toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('timed out') ||
    message.includes('cloud bootstrap timed out') ||
    message.includes('session check timed out')
  );
}

async function queryAssistantOnline(params: {
  accessToken: string;
  clientInteractionId: string;
  questionText: string;
  inputMode: 'voice' | 'text';
  outputMode: 'text' | 'speech' | 'text_and_speech';
}) {
  const env = getClientEnv();
  const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/assistant/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientInteractionId: params.clientInteractionId,
      questionText: params.questionText,
      inputMode: params.inputMode,
      outputMode: params.outputMode,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Hindi pa masagot ngayon. Subukan ulit.');
  }

  return (await response.json()) as {
    clientInteractionId: string;
    status: 'answered';
    answerText: string;
    spokenText: string | null;
    actions: unknown[];
  };
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [appState, setAppState] = useState<LocalAppState | null>(null);
  const [store, setStore] = useState<LocalStore | null>(null);
  const [inventoryItems, setInventoryItems] = useState<LocalInventoryItem[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<LocalTransactionSummary[]>([]);
  const [assistantInteractions, setAssistantInteractions] = useState<LocalAssistantInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const loadCachedData = useCallback(async () => {
    const {
      appStateRepository,
      storeRepository,
      inventoryRepository,
      customerRepository,
      transactionRepository,
      assistantInteractionRepository,
    } =
      await createRepositories();
    const state = await appStateRepository.getOrCreateState();
    setAppState(state);
    const cachedStore = state.activeStoreId
      ? await storeRepository.getStoreById(state.activeStoreId)
      : await storeRepository.getLatestStore();

    setStore(cachedStore);
    setInventoryItems(cachedStore ? await inventoryRepository.listInventoryForStore(cachedStore.id) : []);
    setCustomers(cachedStore ? await customerRepository.listCustomersForStore(cachedStore.id) : []);
    setRecentTransactions(cachedStore ? await transactionRepository.listRecentTransactionsForStore(cachedStore.id) : []);
    setAssistantInteractions(
      cachedStore ? await assistantInteractionRepository.listRecentAssistantInteractionsForStore(cachedStore.id) : [],
    );

    return {
      appStateRepository,
      appState: state,
      storeRepository,
      inventoryRepository,
      customerRepository,
      transactionRepository,
      assistantInteractionRepository,
    };
  }, []);

  const reloadStoreData = useCallback(async (storeId: string) => {
    const { inventoryRepository, customerRepository, transactionRepository, assistantInteractionRepository } =
      await createRepositories();
    setInventoryItems(await inventoryRepository.listInventoryForStore(storeId));
    setCustomers(await customerRepository.listCustomersForStore(storeId));
    setRecentTransactions(await transactionRepository.listRecentTransactionsForStore(storeId));
    setAssistantInteractions(await assistantInteractionRepository.listRecentAssistantInteractionsForStore(storeId));
  }, []);

  const createLedgerService = useCallback((database: SQLite.SQLiteDatabase) => {
    return new LocalLedgerService({
      runAsync: (source, params = []) => database.runAsync(source, params as SQLite.SQLiteBindParams),
      getFirstAsync: (source, params = []) => database.getFirstAsync(source, params as SQLite.SQLiteBindParams),
    });
  }, []);

  const submitLocalCommand = useCallback(
    async (rawText: string, source: CommandSource = 'typed') => {
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
        source,
        storeId: store.id,
        inventoryItems: latestInventoryItems,
        ledgerService: createLedgerService(database),
      });

      if (result.status === 'applied') {
        await reloadStoreData(store.id);
      }

      return result;
    },
    [createLedgerService, reloadStoreData, store],
  );

  const confirmLocalCommand = useCallback(
    async (parserResult: ParserResult, customerName?: string) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { database } = await createRepositories();
      const result = await applyConfirmedParserResult({
        storeId: store.id,
        parserResult,
        customerName,
        source: 'typed',
        ledgerService: createLedgerService(database),
      });
      await reloadStoreData(store.id);

      return result;
    },
    [createLedgerService, reloadStoreData, store],
  );

  const applyManualAdjustment = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { database, inventoryRepository } = await createRepositories();
      const latestInventoryItems = await inventoryRepository.listInventoryForStore(store.id);
      const item = latestInventoryItems.find((currentItem) => currentItem.id === itemId);

      if (!item) {
        throw new Error('Inventory item not found.');
      }

      const ledgerService = createLedgerService(database);
      await ledgerService.applyReadyParserResult(
        store.id,
        {
          raw_text: `manual_adjust:${direction > 0 ? '+' : '-'}1 ${item.name}`,
          normalized_text: `manual adjust ${direction > 0 ? 'add' : 'minus'} 1 ${item.name.toLowerCase()}`,
          intent: direction > 0 ? 'restock' : 'sale',
          confidence: 1,
          status: 'ready_to_apply',
          items: [
            {
              item_id: item.id,
              item_name: item.name,
              matched_alias: item.name.toLowerCase(),
              quantity: 1,
              quantity_delta: direction,
              unit: item.unit,
              confidence: 1,
            },
          ],
          credit: { is_utang: false },
          notes: ['manual_adjustment'],
        },
        { source: 'manual' },
      );

      await reloadStoreData(store.id);
    },
    [createLedgerService, reloadStoreData, store],
  );

  const submitFallbackCommand = useCallback(
    async (entry: { intent: 'sale' | 'restock' | 'utang'; itemId: string; quantity: number; customerName?: string }) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { database, inventoryRepository } = await createRepositories();
      const latestInventoryItems = await inventoryRepository.listInventoryForStore(store.id);
      const item = latestInventoryItems.find((currentItem) => currentItem.id === entry.itemId);

      if (!item) {
        throw new Error('Item not found.');
      }

      const quantity = Math.max(1, Math.floor(entry.quantity));
      const customerName = entry.customerName?.trim();

      if (entry.intent === 'utang' && !customerName) {
        throw new Error('Ilagay ang pangalan ng may utang.');
      }

      const quantityDelta = entry.intent === 'restock' ? quantity : -quantity;
      const rawText =
        entry.intent === 'utang'
          ? `fallback:utang:${quantity}:${item.name}:${customerName}`
          : `fallback:${entry.intent}:${quantity}:${item.name}`;

      const ledgerService = createLedgerService(database);
      await ledgerService.applyReadyParserResult(
        store.id,
        {
          raw_text: rawText,
          normalized_text: rawText.toLowerCase(),
          intent: entry.intent,
          confidence: 1,
          status: 'ready_to_apply',
          items: [
            {
              item_id: item.id,
              item_name: item.name,
              matched_alias: item.name.toLowerCase(),
              quantity,
              quantity_delta: quantityDelta,
              unit: item.unit,
              confidence: 1,
            },
          ],
          credit: entry.intent === 'utang' ? { is_utang: true, customer_name: customerName } : { is_utang: false },
          notes: ['fallback_entry'],
        },
        { source: 'manual' },
      );

      await reloadStoreData(store.id);
    },
    [createLedgerService, reloadStoreData, store],
  );

  const createLocalCustomer = useCallback(
    async (name: string) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { customerRepository } = await createRepositories();
      const customer = await customerRepository.createCustomerForStore(store.id, name);
      await reloadStoreData(store.id);

      return customer;
    },
    [reloadStoreData, store],
  );

  const submitAssistantQuestion = useCallback(
    async (questionText: string, inputMode: 'voice' | 'text') => {
      const trimmed = questionText.trim();
      if (!trimmed) {
        throw new Error('Maglagay muna ng tanong.');
      }

      if (!store) {
        throw new Error('Walang local store sa device.');
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error('Kailangan ng internet at account para sa tanong na ito.');
      }

      const clientInteractionId = `device-assistant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const onlineAnswer = await queryAssistantOnline({
        accessToken,
        clientInteractionId,
        questionText: trimmed,
        inputMode,
        outputMode: 'text',
      });

      const { assistantInteractionRepository } = await createRepositories();
      await assistantInteractionRepository.upsertAssistantInteraction({
        storeId: store.id,
        clientInteractionId: onlineAnswer.clientInteractionId,
        questionText: trimmed,
        answerText: onlineAnswer.answerText,
        spokenText: onlineAnswer.spokenText,
        inputMode,
        status: onlineAnswer.status,
      });
      await reloadStoreData(store.id);

      return {
        answerText: onlineAnswer.answerText,
        status: 'answered' as const,
      };
    },
    [reloadStoreData, store],
  );

  const resolvePendingClaim = useCallback(
    async (decision: 'claim' | 'discard') => {
      const { appStateRepository, transactionRepository } = await createRepositories();
      const state = await appStateRepository.getOrCreateState();
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;

      if (!userId || !state.activeStoreId) {
        throw new Error('Sign in before resolving claim state.');
      }

      if (decision === 'discard') {
        await transactionRepository.discardPendingTransactionsForStore(state.activeStoreId);
      }

      await appStateRepository.updateState({
        migrationOwnerUserId: userId,
        pendingClaimOwnerUserId: null,
        migrationStatus: decision === 'discard' ? 'completed' : 'not_started',
        lastMigrationError: null,
      });

      const nextState = await appStateRepository.getOrCreateState();
      setAppState(nextState);
    },
    [],
  );

  const renameLocalStore = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Store name cannot be empty.');
      }

      const { appStateRepository, storeRepository } = await createRepositories();
      const state = await appStateRepository.getOrCreateState();
      const activeStoreId = state.activeStoreId ?? `guest-store-${state.guestDeviceId}`;
      const existingStore = await storeRepository.getStoreById(activeStoreId);

      if (!existingStore) {
        throw new Error('Store not found locally.');
      }

      await storeRepository.upsertStore({
        ...existingStore,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      });
      setStore({
        ...existingStore,
        name: trimmed,
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSyncNotice(null);

    try {
      const { appStateRepository, appState: state, storeRepository, inventoryRepository, transactionRepository } =
        await loadCachedData();
      let accessToken: string | undefined;
      let userId: string | null = null;

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          LOCAL_REFRESH_TIMEOUT_MS,
          'Session check timed out. Loaded local data only.',
        );
        accessToken = sessionResult.data.session?.access_token;
        userId = sessionResult.data.session?.user?.id ?? null;
      } catch (caughtError) {
        if (isConnectivityIssue(caughtError)) {
          setSyncNotice(DEFAULT_SYNC_NOTICE);
        } else {
          throw caughtError;
        }
      }

      if (!isAuthenticated || !accessToken) {
        const guestStoreId = state.activeStoreId ?? `guest-store-${state.guestDeviceId}`;
        const existingGuestStore = await storeRepository.getStoreById(guestStoreId);
        const guestStore = existingGuestStore ?? createGuestStore(state.guestDeviceId);

        if (!existingGuestStore) {
          await storeRepository.upsertStore(guestStore);
        }

        await appStateRepository.updateState({
          mode: 'guest',
          activeStoreId: guestStore.id,
        });
        setAppState(await appStateRepository.getOrCreateState());
        setStore(guestStore);
        await reloadStoreData(guestStore.id);
        return;
      }

      let result: { storeId: string; inventoryCount: number } | null = null;
      try {
        result = await withTimeout(
          bootstrapLocalData({
            storeRepository,
            inventoryRepository,
            remoteDataSource: new RemoteDataSource(accessToken),
          }),
          LOCAL_REFRESH_TIMEOUT_MS,
          'Cloud bootstrap timed out. Loaded local cache only.',
        );
      } catch (caughtError) {
        if (!isConnectivityIssue(caughtError)) {
          throw caughtError;
        }

        setSyncNotice(DEFAULT_SYNC_NOTICE);
        await appStateRepository.updateState({
          migrationStatus: 'not_started',
          lastMigrationError: null,
        });
        setAppState(await appStateRepository.getOrCreateState());

        const fallbackStoreId = state.activeStoreId;
        if (fallbackStoreId) {
          const fallbackStore = await storeRepository.getStoreById(fallbackStoreId);
          setStore(fallbackStore);
          await reloadStoreData(fallbackStoreId);
        } else {
          setStore(null);
          setInventoryItems([]);
          setCustomers([]);
          setRecentTransactions([]);
          setAssistantInteractions([]);
        }

        return;
      }
      if (!result) {
        return;
      }

      const sourceStoreId = state.activeStoreId ?? `guest-store-${state.guestDeviceId}`;
      const pendingCount = await transactionRepository.countPendingTransactionsForStore(sourceStoreId);
      const ownerMismatch =
        userId !== null &&
        state.migrationOwnerUserId !== null &&
        state.migrationOwnerUserId !== userId &&
        pendingCount > 0;

      if (ownerMismatch) {
        await appStateRepository.updateState({
          pendingClaimOwnerUserId: userId,
          migrationStatus: 'failed',
          lastMigrationError: 'Local guest data is linked to another account. Choose claim or discard.',
        });
        setAppState(await appStateRepository.getOrCreateState());
        return;
      }

      await appStateRepository.updateState({
        mode: 'authenticated',
        activeStoreId: result.storeId,
        migrationOwnerUserId: userId,
        pendingClaimOwnerUserId: null,
        lastBootstrapAt: new Date().toISOString(),
      });

      const pendingTransactions = await transactionRepository.listPendingTransactionsForStore(sourceStoreId, 25);
      if (pendingTransactions.length > 0) {
        await appStateRepository.updateState({
          migrationStatus: 'in_progress',
          lastMigrationError: null,
        });
        setAppState(await appStateRepository.getOrCreateState());

        let uploadResults: Array<{ clientMutationId: string; status: 'synced' | 'needs_review' | 'failed' }> = [];
        try {
          uploadResults = await withTimeout(
            uploadPendingTransactions(accessToken, pendingTransactions),
            LOCAL_REFRESH_TIMEOUT_MS,
            'Sync upload timed out. Pending records were kept locally.',
          );
        } catch (caughtError) {
          if (!isConnectivityIssue(caughtError)) {
            throw caughtError;
          }

          setSyncNotice(DEFAULT_SYNC_NOTICE);
          await appStateRepository.updateState({
            migrationStatus: 'failed',
            lastMigrationError: 'Internet unavailable. Pending records will retry when connection returns.',
          });
          setAppState(await appStateRepository.getOrCreateState());
          const refreshedStore = await storeRepository.getStoreById(result.storeId);
          setStore(refreshedStore);
          await reloadStoreData(result.storeId);
          return;
        }
        const syncedMutationIds = uploadResults
          .filter((resultRow) => resultRow.status === 'synced')
          .map((resultRow) => resultRow.clientMutationId);
        const reviewMutationIds = uploadResults
          .filter((resultRow) => resultRow.status === 'needs_review')
          .map((resultRow) => resultRow.clientMutationId);

        await transactionRepository.updateSyncStatusByClientMutationIds(sourceStoreId, syncedMutationIds, 'synced');
        await transactionRepository.updateSyncStatusByClientMutationIds(
          sourceStoreId,
          reviewMutationIds,
          'needs_review',
        );

        const failed = uploadResults.find((resultRow) => resultRow.status === 'failed');
        await appStateRepository.updateState({
          migrationStatus: failed ? 'failed' : reviewMutationIds.length > 0 ? 'needs_review' : 'completed',
          lastMigrationError: failed ? 'Some records failed to upload. Retry from Profile.' : null,
        });
      }

      const refreshedStore = await storeRepository.getStoreById(result.storeId);
      setAppState(await appStateRepository.getOrCreateState());
      setStore(refreshedStore);
      await reloadStoreData(result.storeId);
    } catch (caughtError) {
      if (isConnectivityIssue(caughtError)) {
        setSyncNotice(DEFAULT_SYNC_NOTICE);
        setError(null);
      } else {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load local data.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadCachedData, reloadStoreData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      appState,
      store,
      inventoryItems,
      customers,
      recentTransactions,
      assistantInteractions,
      pendingTransactions: recentTransactions.filter((transaction) => transaction.syncStatus === 'pending'),
      isLoading,
      error,
      syncNotice,
      refresh,
      submitLocalCommand,
      confirmLocalCommand,
      applyManualAdjustment,
      submitFallbackCommand,
      createLocalCustomer,
      submitAssistantQuestion,
      renameLocalStore,
      resolvePendingClaim,
    }),
    [
      appState,
      applyManualAdjustment,
      assistantInteractions,
      confirmLocalCommand,
      customers,
      error,
      syncNotice,
      inventoryItems,
      isLoading,
      recentTransactions,
      refresh,
      renameLocalStore,
      resolvePendingClaim,
      store,
      createLocalCustomer,
      submitFallbackCommand,
      submitAssistantQuestion,
      submitLocalCommand,
    ],
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
