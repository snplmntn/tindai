# Tindai Codebase vs PRD Audit Report: Offline and Online Capabilities

**Date:** April 25, 2026**Author:** Manus AI**Subject:** Detailed audit of Tindai's actual implementation of offline/online capabilities and their integration points against the Hackathon MVP PRD.

## Executive Summary

The Tindai codebase demonstrates a high degree of fidelity to the Product Requirements Document (PRD), particularly concerning the core offline-first, voice-driven inventory loop. The architecture successfully isolates the local SQLite database as the primary runtime dependency, utilizing Supabase Auth and a Node.js/Express backend strictly for asynchronous cloud synchronization and AI verification.

While the fundamental P0 requirements are met, there are nuanced deviations and partial implementations in the integration layer—specifically around how initial store state is bootstrapped versus how transactions are synchronized. This report details the actual state of the offline capabilities, online capabilities, and the critical integration points bridging them.

## 1. Offline Capabilities Implementation

The PRD mandates a robust offline-first experience where the user can manage inventory, log sales (including credit/utang), and receive alerts without internet connectivity.

### 1.1 Local-First Architecture and Storage

**PRD Requirement:** The app must use a local database (SQLite preferred) that mirrors key Supabase entities, allowing the app to launch, display inventory, and save updates locally without an internet connection.**Actual Implementation:** Fully implemented. The client uses `expo-sqlite` with a comprehensive local schema defined in `client/src/features/local-db/localSchema.ts`. The schema successfully mirrors the cloud model with tables for `app_state`, `stores`, `inventory_items`, `customers`, `transactions`, `transaction_items`, `inventory_movements`, `utang_entries`, `sync_events`, and `assistant_interactions`. The `AppStateRepository` effectively manages offline modes, including a dedicated "guest" mode that allows users to interact with the app before authenticating.

### 1.2 Offline Voice Input and Parsing

**PRD Requirement:** The app must capture spoken Taglish commands using native device speech-to-text, falling back to typed input if STT fails. A local rule-based parser must handle demo-safe commands (sales, restocks, utang) and update inventory immediately.**Actual Implementation:** Fully implemented. `DashboardScreen.tsx` utilizes `expo-speech-recognition` for native voice input, with explicit fallback to typed input. The `localCommandService.ts` and `offlineParser.ts` handle the local parsing. Crucially, the parser correctly identifies intent (`sale`, `restock`, `utang`, `question`) and routes "question" intents to an `online_required` status, exactly as specified in the PRD.

### 1.3 Immediate Offline Inventory Updates

**PRD Requirement:** Offline transactions must update local inventory immediately, be marked as "Pending Sync", and utilize a ledger model for stock counts.**Actual Implementation:** Fully implemented. The `LocalLedgerService` (`client/src/features/ledger/localLedgerService.ts`) acts as the local source of truth. When a parsed command is applied, it writes to `transactions` (with `sync_status = 'pending'`), `transaction_items`, `inventory_movements` (the ledger), and updates the cached `current_stock` in `inventory_items` within a single SQLite transaction. It also correctly handles utang entries and customer creation offline.

### 1.4 Offline Alerts and Analytics

**PRD Requirement:** The app must show rule-based low-stock alerts and basic business analytics (items sold today, estimated sales) offline.**Actual Implementation:** Fully implemented. `DashboardScreen.tsx` computes `lowStockItems` and `inventoryValue` directly from the local SQLite state via `useMemo` hooks. The UI displays these metrics dynamically without requiring network calls.

## 2. Online Capabilities Implementation

The PRD requires online capabilities to be supplementary, focusing on synchronization, AI verification of transactions, and conversational business insights.

### 2.1 Gemini Transaction Verification

**PRD Requirement:** When online, pending transactions are sent to the backend. The backend uses Gemini (via Google AI Studio) to verify, normalize, and improve parsed transactions based on the store's dynamic inventory context.**Actual Implementation:** Fully implemented. The backend (`server/src/models/sync.model.ts`) receives pending transactions. It fetches the authoritative inventory from Supabase, constructs a prompt using `buildTransactionVerificationPrompt`, and calls Gemini via `generateGeminiText`. The `validateGeminiTransactionResponse` ensures strict JSON adherence. If Gemini corrects a transaction, the backend creates a specific `gemini_correction` movement rather than altering the original offline record, preserving the audit trail as mandated.

### 2.2 Conversational Assistant

**PRD Requirement:** An online-only question intent allows users to ask business questions. The backend gathers store context, calls Gemini, and returns a read-only answer.**Actual Implementation:** Fully implemented. The `assistant.model.ts` gathers extensive context (`collectStoreAssistantContext`), including daily sales summaries, low-stock items, and utang balances. It builds a prompt enforcing read-only constraints and language style matching. The client (`DashboardScreen.tsx`) handles the `online_required` state by calling the assistant endpoint and optionally reading the response aloud using `expo-speech`.

### 2.3 Cloud Ledger and RLS

**PRD Requirement:** The backend writes verified records to Supabase using controlled server-side writes. Supabase enforces Row Level Security (RLS) scoped by store ownership.**Actual Implementation:** Fully implemented. The Supabase migration (`20260425000100_initial_dynamic_schema.sql`) defines strict RLS policies ensuring users can only access their own store data. Database triggers enforce ledger integrity (e.g., preventing direct updates to `current_stock` without an accompanying `inventory_movement`). The backend utilizes the Supabase Admin client to bypass RLS for systemic writes, fulfilling the requirement that the mobile app never receives the service role key.

## 3. Offline-Online Integration Points

The integration layer is where the offline-first client synchronizes with the authoritative cloud backend.

### 3.1 Authentication and State Bridging

**PRD Requirement:** First sign-in requires internet. After sign-in, the mobile app caches the session to allow offline work.**Actual Implementation:** Fully implemented. `AuthContext.tsx` manages the transition between `guest` and `authenticated` modes. It hydrates the session using `supabase.auth.getSession()` and utilizes a watchdog timer (`AUTH_LOADING_WATCHDOG_MS`) to safely fallback to offline mode if the initial authentication check times out, ensuring the app remains usable in poor network conditions.

### 3.2 The Sync Pipeline

**PRD Requirement:** The app queues pending transactions and syncs them when the network is available, using `client_mutation_id` for idempotency.**Actual Implementation:** Fully implemented. The client assembles `PendingTransactionForSync` payloads containing raw text, local parse results, and item deltas. The backend endpoint (`/api/v1/verify-transactions`) validates the batch and processes it. Idempotency is strictly enforced at the database level via a unique constraint on `(store_id, client_mutation_id)` in the `transactions` table.

### 3.3 Integration Nuance: Bootstrap vs. Sync

**Gap / Implementation Detail:** While the sync pipeline strictly routes mutations through the Node.js backend for Gemini verification, the initial data hydration path is split.According to `client/src/features/bootstrap/remoteDataSource.ts`, resolving the authenticated store goes through the backend (`/api/v1/store/me`), but fetching the initial inventory snapshot (`getInventoryItems`) bypasses the backend entirely. It uses the Supabase client directly on the mobile device to read from the `inventory_items` table.While this is technically secure (due to RLS) and efficient, it slightly deviates from the PRD's conceptual model of a purely backend-mediated cloud integration. However, it does not violate the core requirement that *writes* (mutations) must go through the backend ledger.

## Conclusion

The Tindai codebase is a highly accurate realization of the Hackathon MVP PRD. The development team successfully prioritized the P0 demo loop: offline voice capture, immediate local ledger updates, and asynchronous cloud verification via Gemini. The architecture enforces the necessary boundaries, ensuring the mobile app remains resilient in offline scenarios while leveraging cloud AI capabilities when connectivity is restored. The minor architectural nuance in the read-path bootstrap does not compromise the integrity of the ledger or the user experience.

