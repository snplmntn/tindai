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
