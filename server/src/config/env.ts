import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export type ServerEnv = {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
};

let cachedEnv: ServerEnv | null = null;

function requireValue(name: keyof Omit<ServerEnv, 'PORT' | 'NODE_ENV'>, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    PORT: Number(process.env.PORT ?? '4000'),
    NODE_ENV: (process.env.NODE_ENV as ServerEnv['NODE_ENV'] | undefined) ?? 'development',
    SUPABASE_URL: requireValue('SUPABASE_URL', process.env.SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY: requireValue(
      'SUPABASE_PUBLISHABLE_KEY',
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
    ),
    SUPABASE_SECRET_KEY: requireValue('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  return cachedEnv;
}
