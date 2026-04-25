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
export type PermissionStatus = 'pending' | 'granted' | 'denied';
export type LocalAuthMode = 'guest' | 'account' | null;

export type LocalAppState = {
  mode: AppMode;
  guestDeviceId: string;
  activeStoreId: string | null;
  onboardingCompleted: boolean;
  authMode: LocalAuthMode;
  microphonePermission: PermissionStatus;
  storagePermission: PermissionStatus;
  tutorialShown: boolean;
  guestConverted: boolean;
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
  cost: number | null;
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

export type LocalUtangCustomerLedger = {
  customerId: string;
  customerName: string;
  utangBalance: number;
  entryCount: number;
  latestEntryAt: string | null;
  itemSummary: string;
};

export type LocalUtangEntrySummary = {
  entryId: string;
  customerId: string;
  customerName: string;
  amount: number;
  note: string | null;
  createdAt: string;
  syncStatus: string;
  itemSummary: string;
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
