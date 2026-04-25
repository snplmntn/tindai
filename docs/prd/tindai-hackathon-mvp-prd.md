# Tindai Hackathon MVP PRD

## 1. Product Summary

**Product name:** Tindai  
**Hackathon goal:** Ship a reliable, demo-ready mobile MVP that lets a micro, small, and medium enterprise owner update inventory by voice, see stock changes immediately, and receive simple business insights even on low-end devices with unreliable internet.

Tindai is a voice-first inventory assistant for sari-sari stores and similar MSMEs. The hackathon MVP focuses on one winning loop:

1. Store owner taps a large microphone button.
2. Store owner says a Taglish sales command, such as "Nakabenta ako ng dalawang Coke Mismo at isang Safeguard."
3. Tindai converts speech to text.
4. Tindai parses the command into inventory changes.
5. Local inventory updates immediately.
6. The app shows low-stock alerts and a simple sales summary.
7. When internet returns, pending transactions sync and are verified with Gemini through Google AI Studio.

The app name is **Tindai**.
The optional assistant persona name is **Tinday**. Use it in UI copy only if it helps the demo feel conversational; do not let naming work block implementation.

All inventory, customers, transactions, and store settings must be dynamic. Any named products or personas in this PRD are demo seed examples only, not hardcoded product constraints.

## 2. Problem

Small store owners track inventory manually, often through memory, paper, or informal notes. This creates several recurring problems:

- Manual stock updates are slow and easy to skip.
- Owners lose visibility into fast-moving and low-stock items.
- Existing POS tools feel too complex for small stores.
- Internet-dependent systems are unreliable in areas with weak connectivity.
- Informal credit, or "utang", is common but hard to track accurately.

## 3. Target User

**Primary persona example:** "Aling Nena", a sari-sari store owner using a low-end Android phone.

Key constraints:

- Small screen.
- Limited device memory and CPU.
- Unreliable mobile data.
- Prefers speaking naturally over typing structured forms.
- Needs fast correction when the app misunderstands.
- Cares about practical output: stock left, sales today, low-stock reminders, and customer utang.

## 4. MVP Principle

For the hackathon, Tindai must prioritize demo reliability over feature breadth.

**Build only the core loop first:** voice input -> local parsing -> inventory update -> alert/insight -> queued cloud verification.

If a feature does not strengthen this loop, it is either stretch scope or out of scope.

## 5. Success Criteria

The MVP is successful if the team can demonstrate the following live:

- User can open the app on a low-end Android device or emulator.
- User can sign in and load their own store workspace.
- User can tap one large mic button and speak a Taglish inventory command.
- App updates local inventory without requiring internet.
- App shows a pending sync state while offline.
- App syncs queued transactions when online.
- Gemini verifies or normalizes pending transactions when online.
- Online question intent can answer simple business questions without mutating inventory.
- App shows at least one low-stock alert.
- App shows at least one simple business insight.
- Demo can still proceed if Wi-Fi fails, using offline mode plus a backup recording.

## 6. Scope

### P0: Demo-Critical Features

These features must be working before pitch rehearsal.

#### 6.1 Authenticated Store Workspace

The MVP uses Supabase Auth so each signed-in user owns exactly one store workspace.

Acceptance criteria:

- User can sign up or sign in with Supabase Auth.
- A new user gets one store record automatically or through first-run setup.
- All store data is scoped by authenticated user.
- Users cannot read or write another user's store data.
- First sign-in requires internet; after sign-in, the mobile app should cache the Supabase session and last synced store snapshot so offline inventory work can continue.
- Multi-store and team membership are not required for the hackathon MVP.

#### 6.2 Single-Screen Mobile Dashboard

The app has one primary screen optimized for low-end phones.

Required UI elements:

- Store name loaded from the authenticated user's store record.
- Optional assistant label: "Tinday is listening..."
- Large tap-to-speak microphone button.
- Inventory list loaded dynamically from local storage.
- Simple transaction status area.
- Low-stock alert area.
- Daily sales summary area.
- Manual plus/minus correction controls per item.

Example seed/demo items:

- Coke Mismo
- Safeguard
- Century Tuna
- Rice
- Eggs

Acceptance criteria:

- UI is usable on a small Android screen.
- Inventory count updates without manual refresh.
- Main action is obvious within 3 seconds.
- Auth is lightweight and does not block the rehearsed demo flow.
- The app works with any inventory items created by the user, not only the seed examples.

#### 6.3 Offline Voice Input

The app captures spoken commands using native device speech-to-text where possible.

Example commands:

- "Nakabenta ako ng dalawang Coke Mismo."
- "Bawas isang Safeguard."
- "Tatlong itlog nabenta."
- "Kumuha si Mang Juan ng dalawang Coke, ilista mo muna."

Acceptance criteria:

- User can trigger STT from the mic button.
- Recognized text is shown before or after processing.
- If STT fails, user can type or use manual +/- fallback.
- App does not crash when speech recognition is unavailable.

#### 6.4 Local Rule-Based Parser

The app includes a lightweight offline parser for demo-safe commands.

Parser responsibilities:

- Detect quantity from Tagalog, English, and numeric forms.
- Detect item keywords from the user's dynamic local inventory aliases.
- Detect sale/decrement intent.
- Detect utang/credit intent for named customers when possible.
- Detect question intent for online assistant queries.
- Produce a local parsed transaction object.

Minimum quantity dictionary:

```json
{
  "isa": 1,
  "isang": 1,
  "one": 1,
  "1": 1,
  "dalawa": 2,
  "dalawang": 2,
  "two": 2,
  "2": 2,
  "tatlo": 3,
  "tatlong": 3,
  "three": 3,
  "3": 3
}
```

Example local output:

```json
{
  "raw_text": "Nakabenta ako ng dalawang Coke Mismo at isang Safeguard",
  "source": "offline_rule_parser",
  "status": "pending_cloud_verification",
  "items": [
    { "item_name": "Coke Mismo", "quantity_delta": -2 },
    { "item_name": "Safeguard", "quantity_delta": -1 }
  ]
}
```

Acceptance criteria:

- Correctly parses at least 5 rehearsed demo commands.
- Handles multiple items in one sentence for the main demo command.
- Uses dynamic item names and aliases from local inventory storage.
- Routes business questions to the online assistant path instead of the inventory mutation path.
- Falls back to pending/unverified status if confidence is low.
- Never blocks local inventory use while waiting for AI.

Intent routing:

```json
{
  "raw_text": "Ano ang pinakamabenta today?",
  "intent": "question",
  "requires_online": true,
  "is_mutation": false
}
```

#### 6.5 Local-First Inventory Storage

The app reads and writes inventory locally first.

Preferred implementation:

- React Native local storage layer using SQLite or another lightweight local database.
- Supabase is used for sync/cloud persistence, not as the primary runtime dependency for the UI.
- The local SQLite schema should mirror the key Supabase entities closely enough to support sync: stores, inventory items, customers, transactions, transaction items, inventory movements, utang entries, sync events, and assistant interactions.

Acceptance criteria:

- App can launch and display inventory without internet.
- Inventory updates are saved locally.
- Transactions are saved locally with sync status.
- Pending transactions survive app restart using the selected local storage layer.

#### 6.6 Offline Inventory Updates

When offline, the app still updates inventory immediately using the local parser.

Acceptance criteria:

- User can turn off Wi-Fi/data and still log a sale.
- UI immediately reflects stock changes.
- Transaction is marked as "Pending Sync" or equivalent.
- User can continue logging multiple transactions offline.

#### 6.7 Queue and Sync

The app queues pending local transactions and syncs them when network is available.

Sync behavior:

1. Save raw voice text, local parsed result, timestamp, and status locally.
2. Detect network availability.
3. Send pending transactions to the backend sync endpoint when online, authenticated with the user's Supabase session/JWT.
4. Backend resolves the signed-in user's store and fetches authoritative dynamic inventory context from Supabase.
5. Backend sends raw text plus store inventory context to Gemini for verification/normalization.
6. Backend stores verified transactions, movements, utang entries, and sync events in Supabase using controlled server-side writes.
7. App marks transactions as synced.

Sync requirements:

- Every offline mutation must include a `client_mutation_id`.
- Supabase enforces uniqueness per store so retries do not double-apply stock changes.
- If Gemini disagrees with the local parse, preserve the original transaction and create a correction movement rather than deleting history.
- The mobile app uses SQLite for offline writes and Supabase Auth for identity. It should not bypass the backend sync path for inventory-changing cloud writes.
- The backend must not trust client-supplied `store_id`, prices, inventory aliases, or item mappings. Client values are hints only; the JWT-resolved store and Supabase catalog are authoritative.

Acceptance criteria:

- Offline transactions show pending state.
- Online sync can be triggered automatically or by a visible "Sync Now" button.
- Successful sync changes status to "Synced".
- Failed sync does not delete local data.

#### 6.8 Gemini Verification via Google AI Studio

Gemini is used online to verify, normalize, and improve parsed transactions. This satisfies the hackathon's Google Tools requirement without making the core app dependent on always-online AI.

Gemini responsibilities:

- Parse Taglish sales commands into strict JSON.
- Normalize item names.
- Resolve fuzzy item matches.
- Identify utang/credit commands.
- Produce optional insight text for synced data.

Required JSON shape:

```json
{
  "intent": "sale",
  "confidence": 0.95,
  "items": [
    {
      "spoken_name": "Coke",
      "matched_item_name": "Coke Mismo",
      "quantity_delta": -2
    }
  ],
  "credit": {
    "is_utang": false,
    "customer_name": null
  },
  "notes": []
}
```

Acceptance criteria:

- Gemini prompt returns valid JSON for rehearsed commands.
- Gemini receives the user's dynamic inventory context, not a hardcoded catalog.
- Backend validates JSON before applying changes.
- Bad AI responses are handled gracefully.
- Gemini is not required for immediate offline stock updates.

#### 6.9 Audit Trail

Every inventory-changing action should create a transaction record. This is the source of truth for sync, verification, analytics, and demo explanation.

Audit trail fields:

- Raw spoken or typed text.
- Local parsed result.
- Inventory delta.
- Timestamp.
- Parser source.
- Sync status.
- Gemini verification status when available.

Acceptance criteria:

- Every stock change appears in a transaction log.
- Inventory uses a ledger model: `inventory_items.current_stock` is cached for fast reads, while `inventory_movements` stores the history.
- Offline transactions are clearly marked pending.
- Synced transactions are clearly marked verified or synced.
- Failed verification does not erase the original raw text.

#### 6.10 Low-Stock Alerts

The app shows simple local low-stock alerts using rule-based thresholds.

Example:

- If Safeguard stock is below 5, show "Low Stock Alert: Order more Safeguard."

Acceptance criteria:

- At least one demo item triggers a low-stock alert during the scripted demo.
- Alerts work offline.
- Alerts do not require LLM calls.

#### 6.11 Basic Business Analytics

The app shows simple analytics useful to MSME owners.

P0 analytics:

- Items sold today.
- Estimated sales count or revenue based on each inventory item's configured price.
- Low-stock list.
- Prediction-driven grocery-trip list with quantity guidance for 7 days, 14 days, and 1 month.

Acceptance criteria:

- Daily summary updates after transactions.
- At least one insight is visible in the demo.
- Analytics can be rule-based offline.

#### 6.12 Utang Tracking

Tindai should support one simple voice-based credit ledger flow because it is highly relevant to sari-sari store operations.

Example command:

"Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna."

Expected behavior:

- Deduct Coke Mismo inventory.
- Create or update the matched customer credit ledger entry for "Mang Juan".
- Mark transaction as credit/utang instead of cash sale.

Acceptance criteria:

- At least one rehearsed utang command works.
- App shows customer name and amount/item owed.
- Utang is stored in a real customer ledger, not only as a text note on a transaction.
- If parser is uncertain, app saves raw text as pending verification.

#### 6.13 Online Conversational Question Intent

Tindai should support an online-only question intent so the owner can ask Tinday simple business questions by voice or text.

Example questions:

- "Ano ang pinakamabenta today?"
- "Ano ang low stock ngayon?"
- "Magkano benta ko today?"
- "Sino ang may utang?"
- "Ano dapat kong i-restock?"

Expected behavior:

- Local intent router classifies the text as `question`.
- App requires internet for this path.
- App sends the question to the backend assistant endpoint with the user's Supabase session/JWT.
- Backend resolves the user's one-store workspace, gathers relevant store context, calls Gemini, and returns an answer.
- App displays the answer and may speak it using native text-to-speech.

Guardrails:

- Question intent is read-only for MVP.
- Conversational answers must not directly mutate inventory, customers, transactions, or utang.
- If Gemini suggests an action, the app presents it as advice only.
- Inventory-changing commands continue to use the offline parser and sync flow.

Acceptance criteria:

- At least one online question can be answered during the demo.
- If offline, the app says the question needs internet while still allowing offline sales logging.
- Assistant answer is based on the signed-in store's dynamic data.
- App can optionally speak the answer using native device TTS.
- Assistant interaction can be logged in Supabase by the backend.

### P1: Wow-Factor Features If Core Loop Is Stable

These should only be built after all P0 features are demo-ready.

#### 6.14 Receipt or Item Scanner

The scanner automates inventory setup by using the camera to detect items or receipts.

Reason to include:

- It addresses manual inventory setup, a major adoption barrier.
- It creates a visual demo moment.

Reason to defer:

- It depends on camera handling, image quality, and online vision parsing.
- It can distract from the stronger voice/offline story.

Recommended hackathon treatment:

- Keep scanner as a stretch feature or scripted prototype.
- Do not let scanner block the voice-to-inventory core loop.
- Aaron should only integrate scanner output after Marc's inventory item model and create/update flow are stable.

Acceptance criteria if built:

- User can take a photo of 3-5 demo products or a receipt.
- Gemini vision returns item candidates.
- User can confirm detected items.
- Confirmed items are added to local inventory.

#### 6.15 Offline-to-Online Sync Demo Toggle

A visible demo mode that makes the offline story obvious to judges.

Possible implementation:

- Show "Offline Mode" state when network is disabled.
- Show pending transaction count.
- Show "Synced" animation or status when network returns.

Acceptance criteria:

- Judges can clearly see that the app worked offline first.
- Sync status is understandable without explanation.



### Out of Scope for Hackathon MVP

Do not build these unless all P0 and selected P1 features are complete:

- Multi-store support.
- Team membership and role permissions.
- Full POS checkout flow.
- Supplier ordering workflow.
- Full receipt expense accounting.
- Manager web dashboard.
- Complex forecasting models.
- Large catalog onboarding.
- Payment integrations.
- Conversational AI directly mutating inventory without explicit confirmation.
- Production-grade security hardening beyond basic API key protection.

## 7. User Stories

### Inventory Update

As a sari-sari store owner, I want to say what I sold so that my inventory updates without typing.

Acceptance criteria:

- Given I have Coke Mismo stock of 10.
- When I say "Nakabenta ako ng dalawang Coke Mismo."
- Then Coke Mismo stock becomes 8.
- And the transaction appears in the log.

### Offline Sale

As a store owner with weak internet, I want to update inventory offline so that my records stay useful even without data.

Acceptance criteria:

- Given the phone is offline.
- When I log a sale by voice.
- Then the app updates local inventory.
- And the transaction is marked pending sync.

### Sync Verification

As a store owner, I want my offline entries verified when internet returns so that errors can be corrected.

Acceptance criteria:

- Given I have pending transactions.
- When internet becomes available.
- Then Tindai sends them to the backend.
- And Gemini verifies the parsed result.
- And synced transactions receive a synced status.

### Low-Stock Alert

As a store owner, I want to know when an item is running low so that I can restock before losing sales.

Acceptance criteria:

- Given Safeguard stock falls below the threshold.
- When inventory updates.
- Then Tindai shows a low-stock alert.

### Utang Ledger

As a store owner, I want to log credit sales by voice so that I can track who owes me money.

Acceptance criteria:

- Given Mang Juan takes 2 Coke Mismo on credit.
- When I say "Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna."
- Then inventory decreases by 2.
- And Mang Juan's utang record increases.

## 8. Functional Requirements

### Mobile App

- Built with React Native and TypeScript.
- Optimized for Android-first demo.
- Uses local-first state and storage.
- Uses SQLite for local storage.
- Uses Supabase Auth for sign-in.
- Provides a large mic button.
- Routes voice/text input through an intent router before deciding mutation vs question flow.
- Displays inventory, alerts, analytics, and sync status.
- Displays online assistant answers and can speak them through native TTS.
- Supports manual correction controls.

### Backend

- Built with Express.js or serverless Node.js, implemented in TypeScript.
- Receives raw text and local parsed transactions.
- Verifies the Supabase JWT and resolves the user's one-store workspace.
- Calls Gemini through Google AI Studio/API.
- Validates Gemini JSON.
- Writes verified records to Supabase.
- Answers read-only assistant questions from store context through `/api/v1/assistant/query`.
- Returns verification result to app.

### Database

Local database is the source of immediate app state. Supabase is the cloud sync and demo persistence layer.

Minimum tables/entities:

- `profiles`
- `stores`
- `inventory_items`
- `transactions`
- `transaction_items`
- `inventory_movements`
- `customers`
- `utang_entries`
- `sync_events`
- `assistant_interactions`

Supabase migration:

- `supabase/migrations/20260425000100_initial_dynamic_schema.sql`

The Supabase schema uses:

- Supabase Auth via `auth.users`.
- One store per authenticated user for MVP.
- Row Level Security scoped by store ownership.
- Decimal inventory quantities using `numeric(12,3)`.
- Ledger-based inventory movement history plus cached current stock.
- Idempotent sync through `client_mutation_id`.
- Real customer utang ledger.
- Soft archiving for catalog/customer records instead of hard deletes.
- Online assistant interaction logging for read-only business questions.

Cloud write model:

- Mobile writes inventory changes to local SQLite first.
- Mobile syncs pending mutations to the backend when online.
- Backend validates auth, calls Gemini if needed, and writes the cloud ledger to Supabase.
- Backend must use the Supabase service role key or an equivalent privileged server-side path for cloud ledger writes. The mobile app must never receive the service role key.
- Mobile can read cloud state from Supabase after auth and can update non-ledger metadata where allowed.
- Stock and utang balances are changed through ledger entries, not direct balance updates.
- Conversational assistant answers are read-only. Any future AI-suggested action must go through explicit user confirmation and the normal mutation/sync path.

Legacy/simple local-only names from earlier notes map as follows:

- `sync_queue` -> `sync_events` plus transaction `sync_status`
- `utang_accounts` -> `customers`
- stock count changes -> `inventory_movements`

## 9. Suggested Data Model

The examples below show sample seed data only. The app must support arbitrary stores, inventory items, aliases, customers, and transactions.

### inventory_items

```json
{
  "id": "item_coke_mismo",
  "store_id": "store_001",
  "name": "Coke Mismo",
  "aliases": ["coke", "coca cola", "coke mismo"],
  "category": "drinks",
  "unit": "pcs",
  "price": 20,
  "current_stock": 10,
  "low_stock_threshold": 5,
  "updated_at": "ISO timestamp"
}
```

`current_stock` represents cached stock after ledger movements. Initial stock should be created through an opening stock or restock movement, not by directly setting `current_stock`.

### transactions

```json
{
  "id": "txn_001",
  "store_id": "store_001",
  "client_mutation_id": "device_abc_txn_001",
  "raw_text": "Nakabenta ako ng dalawang Coke Mismo",
  "sync_status": "pending",
  "parser_source": "offline_rule_parser",
  "created_at": "ISO timestamp",
  "synced_at": null,
  "is_utang": false,
  "customer_id": null
}
```

### transaction_items

```json
{
  "id": "txn_item_001",
  "transaction_id": "txn_001",
  "store_id": "store_001",
  "item_id": "item_coke_mismo",
  "spoken_name": "Coke",
  "quantity_delta": -2,
  "unit_price": 20,
  "line_total": 40
}
```

### inventory_movements

```json
{
  "id": "move_001",
  "store_id": "store_001",
  "item_id": "item_coke_mismo",
  "transaction_id": "txn_001",
  "movement_type": "sale",
  "quantity_delta": -2,
  "stock_after": 8,
  "client_mutation_id": "device_abc_move_001"
}
```

### customers

```json
{
  "id": "customer_mang_juan",
  "store_id": "store_001",
  "display_name": "Mang Juan",
  "utang_balance": 40,
  "updated_at": "ISO timestamp"
}
```

### utang_entries

```json
{
  "id": "utang_entry_001",
  "store_id": "store_001",
  "customer_id": "customer_mang_juan",
  "transaction_id": "txn_002",
  "entry_type": "credit_sale",
  "amount_delta": 40,
  "balance_after": 40,
  "client_mutation_id": "device_abc_utang_001"
}
```

### sync_events

```json
{
  "id": "sync_event_001",
  "store_id": "store_001",
  "device_id": "device_abc",
  "client_batch_id": "batch_001",
  "status": "synced",
  "started_at": "ISO timestamp",
  "finished_at": "ISO timestamp"
}
```

### assistant_interactions

```json
{
  "id": "assistant_001",
  "store_id": "store_001",
  "client_interaction_id": "device_abc_assistant_001",
  "question_text": "Ano ang pinakamabenta today?",
  "answer_text": "Coke Mismo ang pinakamabenta today: 8 units sold.",
  "spoken_text": "Coke Mismo ang pinakamabenta today. Eight units sold.",
  "actions": [],
  "input_mode": "voice",
  "output_mode": "text_and_speech",
  "model": "gemini",
  "status": "answered",
  "asked_at": "ISO timestamp",
  "answered_at": "ISO timestamp"
}
```

## 10. API Contract

### POST /api/v1/verify-transactions

Purpose: Verify locally parsed transactions with Gemini after connectivity returns.

Request:

```json
{
  "transactions": [
    {
      "id": "txn_001",
      "client_mutation_id": "device_abc_txn_001",
      "raw_text": "Nakabenta ako ng dalawang Coke Mismo",
      "local_parse": {
        "items": [
          {
            "local_item_id": "item_coke_mismo",
            "item_name": "Coke Mismo",
            "quantity_delta": -2
          }
        ]
      }
    }
  ]
}
```

The backend must derive `store_id` from the Supabase JWT and must generate `inventory_context` from that store's current dynamic Supabase catalog. Client-sent item IDs, item names, prices, and aliases are local hints only.

Response:

```json
{
  "results": [
    {
      "transaction_id": "txn_001",
      "client_mutation_id": "device_abc_txn_001",
      "status": "verified",
      "confidence": 0.95,
      "items": [
        {
          "item_id": "item_coke_mismo",
          "matched_item_name": "Coke Mismo",
          "quantity_delta": -2
        }
      ],
      "credit": {
        "is_utang": false,
        "customer_name": null
      },
      "notes": []
    }
  ]
}
```

### POST /api/v1/assistant/query

Purpose: Answer read-only business questions when the user is online.

Request:

```json
{
  "client_interaction_id": "device_abc_assistant_001",
  "question_text": "Ano ang pinakamabenta today?",
  "input_mode": "voice",
  "output_mode": "text_and_speech"
}
```

Backend context gathering:

- Verify the Supabase JWT.
- Resolve the user's one-store workspace.
- Fetch relevant inventory, daily sales summary, low-stock items, recent transactions, and utang balances.
- Call Gemini with the question and store context.
- Log the interaction to `assistant_interactions` using the service role.

Response:

```json
{
  "client_interaction_id": "device_abc_assistant_001",
  "status": "answered",
  "answer_text": "Coke Mismo ang pinakamabenta today: 8 units sold.",
  "spoken_text": "Coke Mismo ang pinakamabenta today. Eight units sold.",
  "actions": []
}
```

Assistant query rules:

- `actions` must be empty for the hackathon MVP.
- The backend must not write inventory, transaction, movement, customer, or utang changes from this endpoint.
- If the user asks for a mutation, the assistant should instruct them to use the normal sales/update command.

### GET /api/v1/analytics/summary

Purpose: Return store-scoped analytics for the mobile analytics tabs in one read-only payload.

Response:

```json
{
  "analytics": {
    "meta": {
      "generated_at": "ISO timestamp",
      "store_id": "store_001",
      "currency_code": "PHP",
      "timezone": "Asia/Manila",
      "prediction_mode": "deterministic|gemini_enriched"
    },
    "overview": {
      "sales_today": {},
      "sales_this_month": {},
      "top_selling": [],
      "low_stock": []
    },
    "insights": {
      "sales_trend": [],
      "demand_trend": [],
      "rising_demand": [],
      "declining_demand": []
    },
    "predictions": {
      "forecast": [],
      "restock_soon": [],
      "recommendations": [],
      "model_status": "deterministic_fallback|gemini_enriched",
      "ai_summary": null
    }
  }
}
```

Analytics summary rules:

- Verify Supabase JWT and resolve the signed-in owner's one-store workspace.
- Compute analytics from ledger-backed store data (`inventory_movements`, `transaction_items`, `transactions`, `inventory_items`, and existing sales views).
- Keep this endpoint read-only. It must not mutate inventory, customers, transactions, movements, utang, or sync state.
- If Gemini is unavailable, return deterministic predictions with a fallback model status.

### POST /api/demo/seed-store

Purpose: Backend-only helper endpoint to seed demo inventory and opening stock safely for the signed-in user's store.

Request:

```json
{
  "replace_existing": false
}
```

Backend behavior:

- Verify Supabase JWT.
- Resolve the caller's one-store workspace from auth user.
- Call `public.seed_demo_store(store_id, user_id, replace_existing)` using server-side privileges.
- Return a summary payload for UI/toast feedback.

Response:

```json
{
  "store_id": "store_001",
  "replace_existing": false,
  "created_items": 5,
  "updated_items": 0,
  "opening_stock_movements_inserted": 5
}
```

Seed endpoint rules:

- Endpoint is for demo setup and internal tooling only; do not expose as a public unauthenticated route.
- Seeding must remain ledger-correct: opening stock is created through `inventory_movements` rows (`movement_type = opening_stock`), not direct `current_stock` updates.
- Seeding must be idempotent for the same store.

## 11. Technical Workflows

### Offline Sale: "Nakabenta ako ng dalawang Mismo Coke"

1. User taps the mic button.
2. Native STT returns raw text: "Nakabenta ako ng dalawang Mismo Coke."
3. Local intent router classifies it as a mutation intent, not a question.
4. Local parser maps `dalawang` to `2` and matches `Mismo Coke` against local dynamic inventory aliases.
5. SQLite creates a local `transactions` row with `sync_status = pending`, `raw_text`, `local_parse`, and a unique `client_mutation_id`.
6. SQLite creates local `transaction_items` and `inventory_movements` rows with `quantity_delta = -2`.
7. SQLite updates local cached stock immediately, so the UI changes without internet.
8. Low-stock and daily-summary widgets recompute from local data.
9. When online, the app sends the pending transaction to `/api/v1/verify-transactions` with the Supabase JWT.
10. Backend verifies the JWT, resolves the user's single store, fetches authoritative Supabase inventory context, calls Gemini, validates the JSON, and writes the cloud ledger using the service role.
11. Supabase idempotency on `(store_id, client_mutation_id)` prevents duplicate stock application on retry.
12. App marks the local transaction as `synced` or `verified`; if Gemini disagrees, the app keeps the original record and displays the correction/needs-review state.

### Online Question: "Ano ang low stock ngayon?"

1. User taps the mic button or types a question.
2. Local intent router classifies the input as `question`.
3. If offline, the app says business questions require internet while offline sales still work.
4. If online, the app sends the question to `/api/v1/assistant/query` with the Supabase JWT.
5. Backend verifies the JWT, resolves the user's single store, fetches store context, and calls Gemini.
6. Backend logs the interaction to `assistant_interactions` and returns `answer_text`, optional `spoken_text`, and empty `actions`.
7. App displays the answer and may speak `spoken_text` with native TTS.

## 12. AI Prompt Requirements

The Gemini prompt must:

- Accept Taglish sari-sari store commands.
- Return strict JSON only.
- Support multiple items in one sentence.
- Recognize sales/decrements.
- Recognize utang/credit intent.
- Match spoken names to known inventory aliases.
- Include confidence.
- Return a safe failure object if uncertain.

For assistant questions, Gemini must:

- Answer only from supplied store context.
- Say when data is unavailable or not synced.
- Avoid inventing sales, stock counts, customers, or debts.
- Return concise answer text suitable for display and text-to-speech.
- Not return executable inventory mutations.

Failure response shape:

```json
{
  "intent": "unknown",
  "confidence": 0.2,
  "items": [],
  "credit": {
    "is_utang": false,
    "customer_name": null
  },
  "notes": ["Could not confidently match item name."]
}
```

## 13. Non-Functional Requirements

### Low-End Device Compatibility

- Avoid heavy animations and large image assets.
- Avoid complex navigation.
- Keep app screen count minimal.
- Avoid AI processing on-device.
- Use local rules for offline parsing instead of on-device LLMs.
- Keep demo seed data small and predictable, but do not hardcode the app to those items.

### Offline-First Reliability

- No critical user action should require network access.
- Network calls should be queued or retryable.
- App should never lose raw voice text.
- Failed sync should leave local state intact.

### Demo Reliability

- Prepare 5 rehearsed commands.
- Seed inventory with known values.
- Set thresholds so one command triggers a low-stock alert.
- Include a manual fallback path.
- Prepare a recorded backup demo.

## 14. Team Assignments

### Sean: Lead / Voice AI and Parser

Owns:

- PRD and demo script alignment.
- Voice command flow.
- Offline parser logic.
- Intent router for inventory vs utang vs question.
- Gemini prompt requirements.
- Utang command parsing.
- Final pitch narrative and judge-facing demo flow.

Deliverables:

- Demo command list.
- Parser behavior spec.
- Gemini prompt.
- Rehearsed assistant questions.
- Pitch/demo script.

### Marc: Inventory Manager

Owns:

- Inventory CRUD for demo items.
- Local inventory data model.
- Stock count updates.
- Low-stock alert rules.
- Manual correction controls.

Deliverables:

- Seeded inventory list.
- Local inventory update functions.
- Low-stock alert component.

### Aaron: Scanner / Setup Automation

Owns:

- Receipt/item scanner research and prototype.
- If P0 is stable, camera-to-item detection flow.
- If scanner is deferred, supports QA and demo assets.
- Integration with Marc's inventory manager after item creation/update APIs are stable.

Deliverables:

- P1 scanner prototype or documented fallback.
- Sample receipt/product images for demo.
- Item detection prompt if implemented.

### Jude: Analytics and Cloud Resources

Owns:

- Business analytics summary.
- GCP credits activation.
- Google AI Studio setup support.
- Online insight generation if time allows.
- Assistant answer examples for business questions.

Deliverables:

- Daily sales summary component.
- Low-stock analytics display.
- Google AI Studio access confirmed.
- Demo insights copy.

### Backend Owner: CTO Role

If no separate CTO exists, assign this to the strongest backend developer.

Owns:

- Express.js backend.
- Supabase schema.
- Sync endpoint.
- Gemini verification endpoint.
- Assistant query endpoint.
- API key handling.

Deliverables:

- Supabase project and tables.
- `/api/v1/verify-transactions`.
- `/api/v1/assistant/query`.
- Sync success/failure response.

### Growth / QA Role

If a fifth teammate is available, assign this role.

Owns:

- Sari-sari store validation media.
- User persona.
- QA testing.
- Pitch deck proof points.

Deliverables:

- Store photos/video.
- Persona slide.
- Bug list from testing.

## 15. Hackathon Timeline

### Before Venue

- React Native boilerplate ready.
- Supabase project created if possible.
- Google AI Studio access confirmed.
- Example seed items and 5 demo commands agreed.
- Demo script drafted.

### Hour 4

- Mobile UI drafted.
- Local inventory seeded.
- Gemini prompt returns valid JSON in test console.
- Supabase schema created.
- Supabase Auth sign-in path confirmed.

### Hour 8

- Voice input or typed fallback connected to parser.
- Local inventory updates working.
- Low-stock alert works offline.

### Hour 12

- End-to-end sync path works for at least one transaction.
- Backend receives transaction and returns Gemini verification.
- App can mark transaction as synced.

### Hour 16

- Utang demo flow works.
- Daily summary works.
- Online assistant question works.
- Offline pending queue is visible.
- Pitch deck has problem, solution, market, demo flow, and tech slides.

### Hour 18

- Code freeze.
- No new P1 features unless already working.
- Fix only demo-blocking bugs.

### Hour 20+

- Rehearse live demo repeatedly.
- Record backup demo.
- Prepare offline failure fallback.

## 16. Demo Script

### Setup

"This is Tindai, a voice-first inventory assistant for sari-sari stores. It is designed for low-end phones and unreliable internet."

### Step 1: Show Inventory

Show the signed-in store's seeded example items with current stock.

### Step 2: Voice Sale

Say:

"Nakabenta ako ng dalawang Coke Mismo at isang Safeguard."

Expected result:

- Coke Mismo decreases by 2.
- Safeguard decreases by 1.
- Transaction appears in log.

### Step 3: Low-Stock Alert

Show:

"Low Stock Alert: Order more Safeguard."

### Step 4: Offline Proof

Turn off Wi-Fi or use offline mode indicator.

Say:

"Tatlong itlog nabenta."

Expected result:

- Eggs decrease by 3.
- Transaction is marked pending sync.

### Step 5: Utang Proof

Say:

"Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna."

Expected result:

- Coke Mismo decreases by 2.
- Mang Juan appears in utang ledger.

### Step 6: Online Sync

Turn Wi-Fi/data back on or press "Sync Now."

Expected result:

- Pending transactions sync.
- Gemini verification status appears.
- Pending icon becomes synced check.

### Step 7: Online Question

Say:

"Ano ang low stock ngayon?"

Expected result:

- App routes input as a question, not an inventory mutation.
- Backend answers from store context.
- App displays and optionally speaks the answer.

### Closing

"Tindai does not force store owners to change how they work. They speak naturally, the store keeps running offline, and AI improves the records when internet is available."

## 17. Risks and Mitigations

### Risk: Native STT does not work reliably offline

Mitigation:

- Provide typed command fallback.
- Preload demo commands.
- Allow manual +/- inventory update.

### Risk: Gemini returns malformed JSON

Mitigation:

- Require strict JSON in prompt.
- Validate backend response.
- Use rehearsed commands.
- Keep local parse as fallback.

### Risk: Conversational AI mutates data accidentally

Mitigation:

- Keep `/api/v1/assistant/query` read-only for MVP.
- Return advice text only, with empty `actions`.
- Route inventory-changing language back to the normal offline parser/sync flow.

### Risk: Sync takes too long live

Mitigation:

- Add "Sync Now" button.
- Keep transaction batch small.
- Prepare backup recording.

### Risk: Scanner consumes too much time

Mitigation:

- Treat scanner as P1 only.
- Use static sample image or prototype if not fully integrated.

### Risk: Team builds too broadly

Mitigation:

- Enforce P0 before P1.
- Freeze new features at Hour 18.
- Use seed data and scripted commands for demo reliability.
- Do not hardcode schema, catalog, customer, or store assumptions.

## 18. Final Build Checklist

- Mobile app opens to dashboard.
- User can sign in.
- Example inventory items are seeded or created.
- Large mic button exists.
- At least 5 commands are rehearsed.
- Offline parser handles main commands.
- Local inventory updates instantly.
- Pending sync state is visible.
- Sync endpoint works.
- Gemini verification works for rehearsed commands.
- Online assistant question works for at least one rehearsed business question.
- Low-stock alert appears.
- Daily summary appears.
- Utang flow works.
- Manual correction fallback exists.
- Demo script is rehearsed.
- Backup video is recorded.

## 19. Explicit Non-Goals

For this hackathon, Tindai is not trying to be a complete POS system. It is proving a focused thesis:

**A sari-sari store owner should be able to manage inventory by speaking naturally, even when offline, and receive useful AI-assisted business insights when back online.**
