import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type * as SQLite from 'expo-sqlite';
import * as Network from 'expo-network';

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
import {
  archiveInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  type RemoteInventoryItem,
} from '@/features/inventory/inventoryApi';
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
    spokenText: string | null;
    status: 'answered';
  }>;
  renameLocalStore: (name: string) => Promise<void>;
  resolvePendingClaim: (decision: 'claim' | 'discard') => Promise<void>;
  createLocalInventoryItem: (entry: {
    name: string;
    quantity: number;
    cost: number;
    price: number;
  }) => Promise<void>;
  updateInventoryItemMetadata: (entry: {
    itemId: string;
    name: string;
    cost: number;
    price: number;
    lowStockThreshold: number;
  }) => Promise<void>;
  archiveLocalInventoryItem: (itemId: string) => Promise<void>;
};

const LocalDataContext = createContext<LocalDataState | undefined>(undefined);
const LOCAL_REFRESH_TIMEOUT_MS = 12000;
const DEFAULT_SYNC_NOTICE = 'Offline now. Using local records. We will send updates when internet returns.';
const AUTO_SYNC_COOLDOWN_MS = 15000;
const AUTO_SYNC_POLL_INTERVAL_MS = 45000;

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

function normalizeInventoryAliases(name: string, aliases: string[]) {
  return Array.from(
    new Set(
      [name, ...aliases]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function mergeRemoteInventoryMetadata(params: {
  storeId: string;
  currentStock: number;
  remoteItem: RemoteInventoryItem;
}): LocalInventoryItem {
  const { storeId, currentStock, remoteItem } = params;

  return {
    id: remoteItem.id,
    storeId,
    name: remoteItem.name,
    aliases: remoteItem.aliases,
    unit: remoteItem.unit,
    cost: remoteItem.cost,
    price: remoteItem.price,
    currentStock,
    lowStockThreshold: remoteItem.lowStockThreshold,
    updatedAt: remoteItem.updatedAt,
  };
}

async function syncGuestCatalogToCloud(params: {
  targetStoreId: string;
  inventoryItems: LocalInventoryItem[];
  customers: LocalCustomer[];
}) {
  const { data: remoteItems, error: remoteItemsError } = await supabase
    .from('inventory_items')
    .select('name')
    .eq('store_id', params.targetStoreId)
    .is('archived_at', null);

  if (remoteItemsError) {
    throw new Error('Unable to sync guest items.');
  }

  const existingInventoryNames = new Set((remoteItems ?? []).map((item) => item.name.trim().toLowerCase()));
  const itemsToCreate = params.inventoryItems.filter((item) => !existingInventoryNames.has(item.name.trim().toLowerCase()));

  if (itemsToCreate.length > 0) {
    const { error } = await supabase.from('inventory_items').insert(
      itemsToCreate.map((item) => ({
        store_id: params.targetStoreId,
        name: item.name,
        aliases: item.aliases,
        unit: item.unit,
        cost: item.cost,
        price: item.price,
        low_stock_threshold: item.lowStockThreshold,
      })),
    );

    if (error) {
      throw new Error('Unable to sync guest items.');
    }
  }

  const { data: remoteCustomers, error: remoteCustomersError } = await supabase
    .from('customers')
    .select('display_name')
    .eq('store_id', params.targetStoreId)
    .is('archived_at', null);

  if (remoteCustomersError) {
    throw new Error('Unable to sync guest customer names.');
  }

  const existingCustomerNames = new Set((remoteCustomers ?? []).map((customer) => customer.display_name.trim().toLowerCase()));
  const customersToCreate = params.customers.filter(
    (customer) => customer.name.trim() && !existingCustomerNames.has(customer.name.trim().toLowerCase()),
  );

  if (customersToCreate.length > 0) {
    const { error } = await supabase.from('customers').insert(
      customersToCreate.map((customer) => ({
        store_id: params.targetStoreId,
        display_name: customer.name,
      })),
    );

    if (error) {
      throw new Error('Unable to sync guest customer names.');
    }
  }
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
  const isAutoSyncRunningRef = useRef(false);
  const lastAutoSyncAtRef = useRef(0);

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

  const migrateLocalStoreData = useCallback(
    async (params: { sourceStoreId: string; targetStore: LocalStore }) => {
      const { database, storeRepository } = await createRepositories();
      const now = new Date().toISOString();

      await database.runAsync('begin immediate');

      try {
        await storeRepository.upsertStore(params.targetStore);

        await database.runAsync(`update inventory_items set store_id = ?, updated_at = ? where store_id = ?`, [
          params.targetStore.id,
          now,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update customers set store_id = ?, updated_at = ? where store_id = ?`, [
          params.targetStore.id,
          now,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update transactions set store_id = ? where store_id = ?`, [
          params.targetStore.id,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update transaction_items set store_id = ? where store_id = ?`, [
          params.targetStore.id,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update inventory_movements set store_id = ? where store_id = ?`, [
          params.targetStore.id,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update utang_entries set store_id = ? where store_id = ?`, [
          params.targetStore.id,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update sync_events set store_id = ? where store_id = ?`, [
          params.targetStore.id,
          params.sourceStoreId,
        ]);
        await database.runAsync(`update assistant_interactions set store_id = ? where store_id = ?`, [
          params.targetStore.id,
          params.sourceStoreId,
        ]);

        await database.runAsync('commit');
      } catch (error) {
        await database.runAsync('rollback');
        throw error;
      }
    },
    [],
  );

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
        outputMode: 'text_and_speech',
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
        spokenText: onlineAnswer.spokenText,
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

  const getInventoryMetadataAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error('Kailangan ng internet para ma-save ang item na ito.');
    }

    return accessToken;
  }, []);

  const createLocalInventoryItem = useCallback(
    async (entry: { name: string; quantity: number; cost: number; price: number }) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { database, inventoryRepository } = await createRepositories();
      const quantity = Math.max(0, Math.floor(entry.quantity));
      const price = Math.max(0, entry.price);
      const cost = Math.max(0, entry.cost);
      const lowStockThreshold = quantity > 0 ? Math.min(5, quantity) : 0;
      const trimmedName = entry.name.trim();

      let createdItem: LocalInventoryItem;
      if (appState?.mode === 'authenticated') {
        const accessToken = await getInventoryMetadataAccessToken();
        const remoteItem = await createInventoryItem(accessToken, {
          name: trimmedName,
          aliases: [trimmedName],
          unit: 'pcs',
          cost,
          price,
          lowStockThreshold,
        });

        createdItem = mergeRemoteInventoryMetadata({
          storeId: store.id,
          currentStock: 0,
          remoteItem,
        });
        await inventoryRepository.upsertInventoryItem(createdItem);
      } else {
        createdItem = await inventoryRepository.createInventoryItemForStore({
          storeId: store.id,
          name: trimmedName,
          aliases: [trimmedName],
          unit: 'pcs',
          cost,
          price,
          currentStock: 0,
          lowStockThreshold,
        });
      }

      if (quantity > 0) {
        const ledgerService = createLedgerService(database);
        await ledgerService.applyReadyParserResult(
          store.id,
          {
            raw_text: `opening_stock:${createdItem.name}:${quantity}`,
            normalized_text: `opening stock ${createdItem.name.toLowerCase()} ${quantity}`,
            intent: 'restock',
            confidence: 1,
            status: 'ready_to_apply',
            items: [
              {
                item_id: createdItem.id,
                item_name: createdItem.name,
                matched_alias: createdItem.name.toLowerCase(),
                quantity,
                quantity_delta: quantity,
                unit: createdItem.unit,
                confidence: 1,
              },
            ],
            credit: { is_utang: false },
            notes: ['opening_stock'],
          },
          { source: 'manual' },
        );
      }

      await reloadStoreData(store.id);
    },
    [appState?.mode, createLedgerService, getInventoryMetadataAccessToken, reloadStoreData, store],
  );

  const updateInventoryItemMetadata = useCallback(
    async (entry: { itemId: string; name: string; cost: number; price: number; lowStockThreshold: number }) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { inventoryRepository } = await createRepositories();
      const latestInventoryItems = await inventoryRepository.listInventoryForStore(store.id);
      const currentItem = latestInventoryItems.find((item) => item.id === entry.itemId);

      if (!currentItem) {
        throw new Error('Inventory item not found.');
      }

      const trimmedName = entry.name.trim();
      const price = Math.max(0, entry.price);
      const cost = Math.max(0, entry.cost);
      const lowStockThreshold = Math.max(0, entry.lowStockThreshold);

      let nextItem: LocalInventoryItem;
      if (appState?.mode === 'authenticated') {
        const accessToken = await getInventoryMetadataAccessToken();
        const remoteItem = await updateInventoryItem(accessToken, entry.itemId, {
          name: trimmedName,
          cost,
          price,
          lowStockThreshold,
        });

        nextItem = mergeRemoteInventoryMetadata({
          storeId: store.id,
          currentStock: currentItem.currentStock,
          remoteItem,
        });
      } else {
        nextItem = {
          ...currentItem,
          name: trimmedName,
          aliases: normalizeInventoryAliases(trimmedName, currentItem.aliases),
          cost,
          price,
          lowStockThreshold,
          updatedAt: new Date().toISOString(),
        };
      }

      await inventoryRepository.upsertInventoryItem(nextItem);
      await reloadStoreData(store.id);
    },
    [appState?.mode, getInventoryMetadataAccessToken, reloadStoreData, store],
  );

  const archiveLocalInventoryItem = useCallback(
    async (itemId: string) => {
      if (!store) {
        throw new Error('No local store is available.');
      }

      const { inventoryRepository } = await createRepositories();

      if (appState?.mode === 'authenticated') {
        const accessToken = await getInventoryMetadataAccessToken();
        await archiveInventoryItem(accessToken, itemId);
      }

      await inventoryRepository.archiveInventoryItemForStore(store.id, itemId);
      await reloadStoreData(store.id);
    },
    [appState?.mode, getInventoryMetadataAccessToken, reloadStoreData, store],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSyncNotice(null);

      try {
        const {
          appStateRepository,
          appState: state,
          storeRepository,
          inventoryRepository,
          customerRepository,
          transactionRepository,
        } = await loadCachedData();
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
          guestConverted: false,
        });
        setAppState(await appStateRepository.getOrCreateState());
        setStore(guestStore);
        await reloadStoreData(guestStore.id);
        return;
      }

        const sourceStoreId = state.activeStoreId ?? `guest-store-${state.guestDeviceId}`;
        const pendingCount = await transactionRepository.countPendingTransactionsForStore(sourceStoreId);
        const localSourceInventory = await inventoryRepository.listInventoryForStore(sourceStoreId);
        const localSourceCustomers = await customerRepository.listCustomersForStore(sourceStoreId);
        const shouldMigrateGuestData =
          state.mode === 'guest' &&
          sourceStoreId.startsWith('guest-store-') &&
          (localSourceInventory.length > 0 || pendingCount > 0);

        let result: { storeId: string; inventoryCount: number } | null = null;
        try {
          if (state.guestConverted && state.mode === 'authenticated' && state.activeStoreId) {
            const remoteDataSource = new RemoteDataSource(accessToken);
            const remoteStore = await withTimeout(
              remoteDataSource.getCurrentStore(),
              LOCAL_REFRESH_TIMEOUT_MS,
              'Cloud bootstrap timed out. Loaded local cache only.',
            );
            await storeRepository.upsertStore(remoteStore);
            result = {
              storeId: remoteStore.id,
              inventoryCount: localSourceInventory.length,
            };
          } else {
            result = await withTimeout(
              bootstrapLocalData({
                storeRepository,
                inventoryRepository,
                remoteDataSource: new RemoteDataSource(accessToken),
              }),
              LOCAL_REFRESH_TIMEOUT_MS,
              'Cloud bootstrap timed out. Loaded local cache only.',
            );
          }
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

        if (shouldMigrateGuestData) {
          await syncGuestCatalogToCloud({
            targetStoreId: result.storeId,
            inventoryItems: localSourceInventory,
            customers: localSourceCustomers,
          });

          const authenticatedStore = await storeRepository.getStoreById(result.storeId);
          if (authenticatedStore) {
            await migrateLocalStoreData({
              sourceStoreId,
              targetStore: authenticatedStore,
            });
          }
        }

        await appStateRepository.updateState({
          mode: 'authenticated',
          activeStoreId: result.storeId,
          guestConverted: shouldMigrateGuestData || state.guestConverted,
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
    }, [isAuthenticated, loadCachedData, migrateLocalStoreData, reloadStoreData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const triggerAutoSync = useCallback(
    async (_reason: 'network_reconnected' | 'app_foreground' | 'poll') => {
      if (!isAuthenticated || isLoading || isAutoSyncRunningRef.current) {
        return;
      }

      const hasPendingTransactions = recentTransactions.some((transaction) => transaction.syncStatus === 'pending');
      if (!hasPendingTransactions) {
        return;
      }

      const now = Date.now();
      if (now - lastAutoSyncAtRef.current < AUTO_SYNC_COOLDOWN_MS) {
        return;
      }

      isAutoSyncRunningRef.current = true;
      lastAutoSyncAtRef.current = now;

      try {
        await refresh();
      } finally {
        isAutoSyncRunningRef.current = false;
      }
    },
    [isAuthenticated, isLoading, recentTransactions, refresh],
  );

  useEffect(() => {
    let wasOnline = false;

    const toOnlineStatus = (state: Network.NetworkState) =>
      Boolean(state.isConnected) && state.isInternetReachable !== false;

    const primeNetworkStatus = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        wasOnline = toOnlineStatus(state);
      } catch {
        wasOnline = false;
      }
    };

    void primeNetworkStatus();

    const networkSubscription = Network.addNetworkStateListener((state) => {
      const isOnline = toOnlineStatus(state);
      if (isOnline && !wasOnline) {
        void triggerAutoSync('network_reconnected');
      }
      wasOnline = isOnline;
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void triggerAutoSync('app_foreground');
      }
    });

    const pollTimer = setInterval(() => {
      void triggerAutoSync('poll');
    }, AUTO_SYNC_POLL_INTERVAL_MS);

    return () => {
      networkSubscription.remove();
      appStateSubscription.remove();
      clearInterval(pollTimer);
    };
  }, [triggerAutoSync]);

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
      createLocalInventoryItem,
      updateInventoryItemMetadata,
      archiveLocalInventoryItem,
    }),
    [
      appState,
      applyManualAdjustment,
      archiveLocalInventoryItem,
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
      createLocalInventoryItem,
      createLocalCustomer,
      submitFallbackCommand,
      submitAssistantQuestion,
      submitLocalCommand,
      updateInventoryItemMetadata,
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
