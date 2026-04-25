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

function mapStoreRecord(data: StoreRecord): Store {
  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    currencyCode: data.currency_code,
    timezone: data.timezone,
    updatedAt: data.updated_at,
  };
}

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

  return mapStoreRecord(data);
}

export async function updateStoreNameByOwnerId(ownerId: string, name: string): Promise<Store | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('stores')
    .update({ name })
    .eq('owner_id', ownerId)
    .select('id, owner_id, name, currency_code, timezone, updated_at')
    .maybeSingle<StoreRecord>();

  if (error) {
    throw new Error('Store update failed.');
  }

  if (!data) {
    return null;
  }

  return mapStoreRecord(data);
}

export async function createStoreByOwnerId(ownerId: string, name: string): Promise<Store | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('stores')
    .upsert(
      {
        owner_id: ownerId,
        name,
      },
      {
        onConflict: 'owner_id',
      },
    )
    .select('id, owner_id, name, currency_code, timezone, updated_at')
    .maybeSingle<StoreRecord>();

  if (error) {
    throw new Error('Store creation failed.');
  }

  if (!data) {
    return null;
  }

  return mapStoreRecord(data);
}
