# Tindai

An Expo + TypeScript starter with:

- Welcome screen
- Auth screen
- Three-tab home navigation

## Run

1. Copy `.env.example` to `.env` and set Supabase values.
2. Install dependencies: `npm install`
3. Start the app: `npm run start`
4. Open on iOS, Android, or web from the Expo dev tools

## Android Dev Client (Voice Input)

Voice input uses native speech recognition, so use a development build (not Expo Go).

- First-time or when native dependencies change:
  - `npm run dev-client`
- Install/update app only:
  - `npm run dev-client:install`
- Start Metro only:
  - `npm run dev-client:start`
- Start Metro without clearing cache:
  - `npm run dev-client:start:noclear`

The `dev-client` script runs Android `installDebug` then starts Metro with `--dev-client --clear`.

## Google OAuth (ID Token -> Backend Exchange)

- Enable `Google` in Supabase Auth providers.
- Set Google OAuth client IDs in `client/.env`:
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com`
  - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com`
  - Optional: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com`
- The app gets a Google `id_token` then calls backend `POST /api/v1/auth/google/exchange`.
- Backend exchanges the Google token with Supabase and returns session tokens.
- Client persists the Supabase session using `supabase.auth.setSession(...)`.
- Supabase Auth redirect URL allowlist is not used by this flow.
