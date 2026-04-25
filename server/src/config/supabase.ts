import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from './env';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const env = getEnv();

  adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
