import { getSupabaseAdminClient } from '../config/supabase';

export type Store = {
  id: string;
  ownerId: string;
  name: string;
  currencyCode: string;
  timezone: string;
  updatedAt: string;
};

type StoreRecord = {
  id: string;
  owner_id: string;
  name: string;
  currency_code: string;
  timezone: string;
  updated_at: string;
};

export async function getStoreByOwnerId(ownerId: string): Promise<Store | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('stores')
    .select('id, owner_id, name, currency_code, timezone, updated_at')
    .eq('owner_id', ownerId)
    .maybeSingle<StoreRecord>();

  if (error) {
    throw new Error('Store lookup failed.');
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    currencyCode: data.currency_code,
    timezone: data.timezone,
    updatedAt: data.updated_at,
  };
}
