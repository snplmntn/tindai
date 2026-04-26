import { Platform } from 'react-native';

export type ClientEnv = {
  EXPO_PUBLIC_API_BASE_URL: string;
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  EXPO_PUBLIC_ANDROID_EMULATOR_LOOPBACK: string | null;
};

let cachedEnv: ClientEnv | null = null;

function requireValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function resolveApiBaseUrl(
  rawBaseUrl: string | undefined,
  platformOS: string,
  androidEmulatorLoopbackFlag: string | undefined,
) {
  const fallbackBaseUrl = 'http://localhost:4000';
  const candidateBaseUrl = rawBaseUrl?.trim() || fallbackBaseUrl;

  try {
    const resolvedUrl = new URL(candidateBaseUrl);

    const forceEmulatorLoopback = androidEmulatorLoopbackFlag?.trim().toLowerCase() === 'true';
    if (platformOS === 'android' && forceEmulatorLoopback && isLoopbackHostname(resolvedUrl.hostname)) {
      resolvedUrl.hostname = '10.0.2.2';
    }

    resolvedUrl.pathname = resolvedUrl.pathname.replace(/\/$/, '');
    return resolvedUrl.toString().replace(/\/$/, '');
  } catch {
    return candidateBaseUrl;
  }
}

export function getClientEnv(): ClientEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    EXPO_PUBLIC_API_BASE_URL: resolveApiBaseUrl(
      process.env.EXPO_PUBLIC_API_BASE_URL,
      Platform.OS,
      process.env.EXPO_PUBLIC_ANDROID_EMULATOR_LOOPBACK,
    ),
    EXPO_PUBLIC_SUPABASE_URL: requireValue('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requireValue(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    EXPO_PUBLIC_ANDROID_EMULATOR_LOOPBACK: process.env.EXPO_PUBLIC_ANDROID_EMULATOR_LOOPBACK ?? null,
  };

  return cachedEnv;
}
