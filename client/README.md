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

Android native builds look for the SDK in `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or the default macOS path at `~/Library/Android/sdk`.

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
