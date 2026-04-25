export type ClientEnv = {
  EXPO_PUBLIC_API_BASE_URL: string;
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string | null;
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: string | null;
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: string | null;
};

let cachedEnv: ClientEnv | null = null;

function requireValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getClientEnv(): ClientEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    EXPO_PUBLIC_SUPABASE_URL: requireValue('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requireValue(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? null,
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? null,
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? null,
  };

  return cachedEnv;
}
