# AGENTS.md

## Project Context

Tindai is a hackathon MVP for a voice-first, offline-capable sari-sari store inventory assistant.

Current repository contents:

- `docs/prd/`: product requirements and implementation planning documents.
- `supabase/migrations/`: Supabase schema, RLS policies, ledger triggers, and views.

Expected application architecture from the PRD:

- Mobile app: React Native + TypeScript, Android-first, local-first storage with SQLite.
- Backend: TypeScript Node.js API, Express or serverless.
- Cloud: Supabase Auth, database, RLS, and server-side ledger writes.
- AI: Gemini for online verification and read-only business question answering.

Prioritize the core loop: voice or typed command -> offline parser -> local inventory update -> pending sync -> backend verification -> Supabase ledger write.

## Repository Rules

- Keep demo reliability above feature breadth.
- Treat named products, customers, and personas in docs as demo seed examples only. Do not hardcode them as product constraints.
- Keep inventory, customers, transactions, stores, aliases, and assistant interactions dynamic and store-scoped.
- Preserve raw voice or typed text for every inventory-changing action.
- Inventory and utang balances must be ledger-driven. Do not bypass `inventory_movements` or `utang_entries` when changing balances.
- Mobile clients must never receive Supabase service role keys or write cloud ledger rows directly.
- `/api/assistant/query` is read-only for MVP. It must not mutate inventory, transactions, customers, movements, or utang records.

## Instruction Hygiene

Keep this file short and high-signal. Treat it as a map to source-of-truth docs, not a full manual.

- Keep only repository-specific rules that are hard to infer from code.
- Prefer explicit commands and paths over generic advice.
- If a rule needs a long explanation, move details into `docs/` and link to it here.
- Remove stale instructions quickly when scripts, paths, or architecture change.
- Avoid volatile details such as temporary deadlines or personal preferences.
- Avoid repeating default language/framework conventions that the agent already knows.

When adding nested `AGENTS.md` files later:

- Root `AGENTS.md` should hold global project rules.
- Subdirectory `AGENTS.md` files should only add rules specific to that subtree.
- Do not duplicate the same rule across root and nested files unless necessary for safety.

## Development Workflow

- Read the relevant PRD section before changing behavior.
- Prefer small, demo-safe changes that strengthen the P0 workflow.
- Add or update tests for parser, sync, ledger, and auth behavior when implementation files exist.
- Keep SQL migrations append-only after they are shared. Do not rewrite an applied migration unless the team explicitly agrees.
- If a schema change affects app/backend contracts, update the PRD or API documentation in the same change.
- If package manifests are added later, use the scripts already defined there instead of inventing parallel commands.

## Build And Check Commands

This repo currently has documentation and Supabase SQL only; there is no app package, backend package, or CI workflow yet.

Before committing documentation-only changes:

- Review Markdown rendering for changed files.
- Check internal links and referenced paths manually.

Before committing Supabase migration changes:

- Run `supabase db lint` when the Supabase CLI is configured for the project.
- Run `supabase db reset` when local Supabase and Docker are available, then verify the migration applies cleanly from an empty database.
- Inspect RLS policies, grants, triggers, and generated views for store ownership boundaries.

When a mobile package exists, run its local checks before committing mobile changes:

- TypeScript typecheck.
- Lint.
- Unit tests for parser, local storage, sync queue, and UI state reducers.
- Android smoke run for the main dashboard and offline transaction flow.

When a backend package exists, run its local checks before committing backend changes:

- TypeScript typecheck.
- Lint.
- Unit/integration tests for auth, sync, Gemini JSON validation, and Supabase writes.
- Endpoint smoke checks for core API routes (`/api/verify-transactions`, `/api/assistant/query`) plus any active demo routes.

## Commit Convention

Use this subject format:

```text
type(scope): message
```

Use a short, imperative message in the subject. Keep it specific.

Recommended types:

- `feat`: new user-facing or product behavior.
- `fix`: bug fix.
- `docs`: documentation-only changes.
- `schema`: Supabase schema, migration, trigger, policy, or seed changes.
- `test`: tests or fixtures.
- `refactor`: internal restructuring without behavior change.
- `chore`: tooling, config, dependency, or housekeeping changes.

Recommended scopes:

- `prd`
- `docs`
- `supabase`
- `schema`
- `rls`
- `parser`
- `mobile`
- `backend`
- `sync`
- `assistant`
- `utang`
- `analytics`

Commit body should include a concise TLDR-style summary in bullets:

```text
type(scope): message

- Changed the main behavior or artifact.
- Added the important supporting detail.
- Called out tests, checks, or migration impact.
```

Examples:

```text
docs(prd): clarify offline parser expansion

- Adds language-pack guidance for Tagalog, Taglish, and Bisaya commands.
- Defines confidence thresholds for auto-apply, confirmation, and fallback.
- Notes parser corpus checks required before demo rehearsal.
```

```text
schema(supabase): add ledger-backed inventory tables

- Creates store-scoped transactions, transaction items, and inventory movements.
- Enforces idempotency with client mutation IDs.
- Adds RLS policies and dashboard views for authenticated users.
```

## Review Checklist

Before finalizing a change, confirm:

- The change supports the P0 demo loop or is clearly documented as P1/P2.
- Offline inventory updates still work without Gemini.
- Cloud sync remains authenticated and store-scoped.
- Raw text, local parse, sync status, and verification status are preserved.
- Assistant question handling remains read-only.
- Any schema or API contract changes are reflected in docs.
- Relevant checks were run, or the reason they could not be run is stated clearly.
