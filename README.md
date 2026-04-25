# Tindai

This repo has two separate apps:

- `client/`: Expo + React Native mobile app
- `server/`: Express + TypeScript API with Supabase integration

## Prerequisites

- Node.js 20+
- npm
- Expo Go or an Android/iOS simulator for the client
- A Supabase project for the server

## Project Structure

```text
tindai/
├── client/
└── server/
```

## Client App

Install dependencies:

```bash
cd client
npm install
```

Start the Expo app:

```bash
npm run start
```

Useful client commands:

```bash
npm run android
npm run ios
npm run web
npm run typecheck
npm test
```

## Server App

Install dependencies:

```bash
cd server
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Set these values in `server/.env`:

- `PORT`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Run the API in development:

```bash
npm run dev
```

Useful server commands:

```bash
npm run build
npm run start
npm run typecheck
npm test
```

Default server routes:

- `GET /health`
- `GET /api/v1/auth/me`
- `GET /api/v1/profile/me`
- `PATCH /api/v1/profile/me`
- `DELETE /api/v1/profile/me/avatar`

The server listens on the `PORT` from `.env`, which defaults to `4000`.

## Run Both Apps

Use two terminals.

Terminal 1:

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Terminal 2:

```bash
cd client
npm install
npm run start
```

Then open the Expo app on Android, iOS, or web.
