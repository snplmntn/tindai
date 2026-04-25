# Auth-Scoped Local Foundation Plan

## Goal

Implement the first foundation milestone for Tindai's AI/parser/dashboard work: authenticated store bootstrap plus a full local SQLite schema that can support offline inventory changes, pending sync, Gemini verification, dashboard reads, and future assistant interactions.

## Decisions

- Use `expo-sqlite` as the client local source of truth.
- Mirror Supabase table and column names in SQLite where practical, using `snake_case` locally and mapping to app-friendly TypeScript types at the repository boundary.
- Scope local data to the authenticated Supabase account/store from the first pass.
- Add `GET /api/v1/store/me` so the client can resolve the current user's one store through the backend.
- Do not auto-seed inventory from the client.
- If the authenticated store has no inventory, show an empty dashboard/setup state.
- Preserve the PRD ledger model: stock and utang changes flow through transaction, movement, and utang ledger rows.

## Milestone 1 Scope

### Server

- Add `GET /api/v1/store/me`.
- Require a Supabase bearer token.
- Resolve `stores.owner_id = req.user.id`.
- Return the current store payload.
- Add tests for authenticated success and missing store failure.

### Client

- Add `expo-sqlite`.
- Create a local migration runner.
- Create full local tables:
  - `stores`
  - `inventory_items`
  - `customers`
  - `transactions`
  - `transaction_items`
  - `inventory_movements`
  - `utang_entries`
  - `sync_events`
  - `assistant_interactions`
- Create local repositories for store and inventory bootstrap.
- After auth session load, fetch the authenticated store and inventory snapshot and cache them locally.
- Update the dashboard to read store/inventory from SQLite.
- Show an empty state when inventory has not been seeded in Supabase.

## Follow-Up Milestones

1. Parser and local ledger writes.
2. Dashboard core loop UI.
3. Backend sync and Gemini verification.
4. Read-only assistant query.
5. Utang polish and demo hardening.

## Verification

- Server: `npm test`, `npm run typecheck`.
- Client: `npm test`, `npm run typecheck`.
- Manual: sign in, load dashboard, confirm local SQLite reflects the authenticated store and synced inventory.
