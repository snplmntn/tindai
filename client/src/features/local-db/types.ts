export type LocalStore = {
  id: string;
  ownerId: string;
  name: string;
  currencyCode: string;
  timezone: string;
  updatedAt: string;
};

export type AppMode = 'guest' | 'authenticated';
export type MigrationStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'needs_review';

export type LocalAppState = {
  mode: AppMode;
  guestDeviceId: string;
  activeStoreId: string | null;
  migrationStatus: MigrationStatus;
  migrationOwnerUserId: string | null;
  pendingClaimOwnerUserId: string | null;
  lastMigrationError: string | null;
  lastBootstrapAt: string | null;
  updatedAt: string;
};

export type LocalInventoryItem = {
  id: string;
  storeId: string;
  name: string;
  aliases: string[];
  unit: string;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
  updatedAt: string;
};

export type LocalCustomer = {
  id: string;
  storeId: string;
  name: string;
  utangBalance: number;
};

export type LocalTransactionSource = 'voice' | 'typed' | 'manual';

export type LocalTransactionSummary = {
  id: string;
  storeId: string;
  rawText: string;
  source: LocalTransactionSource;
  syncStatus: string;
  parserSource: string;
  intent: string | null;
  primaryItemName: string | null;
  primaryQuantityDelta: number | null;
  isUtang: boolean;
  createdAt: string;
};

export type LocalAssistantInteraction = {
  id: string;
  storeId: string;
  clientInteractionId: string;
  questionText: string;
  answerText: string | null;
  spokenText: string | null;
  inputMode: 'voice' | 'text';
  status: string;
  createdAt: string;
  syncedAt: string | null;
};
