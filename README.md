# Tindai

Tindai is a voice-first, offline-capable inventory assistant for sari-sari stores and similar small retail businesses. It helps store owners record sales, restocks, and utang using natural Taglish voice or text commands, update stock locally right away, and sync verified records to the cloud when internet becomes available.

## What Tindai Does

- Logs inventory activity through voice or typed commands
- Works offline first with local storage on the device
- Updates stock immediately after a parsed command
- Tracks pending sync state for offline transactions
- Supports utang-aware store workflows
- Shows low-stock warnings and simple business insights
- Uses a backend plus Gemini verification when online

## Project Structure

```text
tindai/
├── client/    Expo + React Native mobile app
├── server/    Express + TypeScript API
├── supabase/  SQL migrations and database policies
└── docs/      PRDs, plans, audits, and project notes
```

## Architecture

Tindai follows a local-first flow:

1. The store owner speaks or types a command.
2. The mobile app parses it locally.
3. Inventory and transaction data update in SQLite immediately.
4. The app marks the transaction as pending if cloud sync is unavailable.
5. When online, the server verifies and syncs the transaction to Supabase.

This keeps the core inventory workflow usable even with weak or unstable connectivity.

## Tech Stack

### Mobile client

- Expo
- React Native
- TypeScript
- SQLite
- Supabase Auth

### Backend

- Node.js
- Express
- TypeScript
- Supabase
- Gemini API

## Prerequisites

- Node.js 20+
- npm
- Expo Go or an Android/iOS simulator
- A Supabase project

## Environment Setup

### Server

Create `server/.env` and set:

```env
PORT=4000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3-flash-preview
```

Notes:

- `SUPABASE_ANON_KEY` can be used as a fallback for `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` can be used as a fallback for `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY` is optional if you want to run without online AI verification

### Client

Create `client/.env` and set:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Notes:

- On Android emulator, localhost is resolved to `10.0.2.2` automatically
- Google client IDs are optional unless you are testing Google sign-in

## Install And Run

Open two terminals from the repo root.

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The API runs on `http://localhost:4000` by default.

### 2. Start the mobile app

```bash
cd client
npm install
npm run start
```

Useful client commands:

```bash
npm run android
npm run ios
npm run web
npm run dev-client
npm run typecheck
npm test
```

Useful server commands:

```bash
npm run build
npm run start
npm run typecheck
npm test
```

## API Notes

The server includes routes for health checks, auth-scoped store data, profile data, inventory sync, assistant queries, and analytics. The exact mounted routes live in `server/src/routes/`.

## Current Focus

Tindai is currently a hackathon MVP focused on one reliable loop:

- capture a store action
- update inventory locally
- keep working offline
- sync safely when online

The goal is practical reliability for real sari-sari store workflows, not a full POS system.

## Documentation

Useful project docs:

- `docs/prd/tindai-hackathon-mvp-prd.md`
- `docs/tindai-project-summary.txt`
- `docs/audit_report.md`
- `docs/implementation_gaps_report.md`

## Development Notes

- Keep changes aligned with the offline-first inventory flow
- Treat cloud sync as a follow-up to local success, not a prerequisite
- Keep inventory, customers, transactions, and utang records dynamic and store-scoped
- Do not bypass ledger-style inventory updates in the backend data model

## License

No license file is currently included in this repository.
