-- Tindai initial dynamic Supabase schema.
-- Designed for a local-first mobile app that syncs authenticated user data to Supabase.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.transaction_source as enum (
    'voice',
    'manual',
    'scanner',
    'receipt',
    'sync',
    'system'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sync_status as enum (
    'pending',
    'synced',
    'verified',
    'needs_review',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.movement_type as enum (
    'opening_stock',
    'sale',
    'utang_sale',
    'restock',
    'manual_adjustment',
    'scanner_import',
    'receipt_import',
    'gemini_correction',
    'void',
    'system_correction'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.utang_entry_type as enum (
    'credit_sale',
    'payment',
    'adjustment',
    'void'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.assistant_interaction_status as enum (
    'pending',
    'answered',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Store',
  currency_code text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_one_per_owner unique (owner_id),
  constraint stores_currency_code_length check (char_length(currency_code) = 3),
  constraint stores_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sku text,
  name text not null,
  description text,
  category text,
  unit text not null default 'pcs',
  aliases text[] not null default '{}'::text[],
  price numeric(12,2) not null default 0,
  cost numeric(12,2),
  current_stock numeric(12,3) not null default 0,
  low_stock_threshold numeric(12,3) not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_name_not_blank check (btrim(name) <> ''),
  constraint inventory_items_unit_not_blank check (btrim(unit) <> ''),
  constraint inventory_items_price_non_negative check (price >= 0),
  constraint inventory_items_cost_non_negative check (cost is null or cost >= 0),
  constraint inventory_items_low_stock_non_negative check (low_stock_threshold >= 0)
);

create unique index if not exists inventory_items_store_name_unique
  on public.inventory_items (store_id, lower(name))
  where archived_at is null;

create unique index if not exists inventory_items_store_sku_unique
  on public.inventory_items (store_id, lower(sku))
  where sku is not null and archived_at is null;

create index if not exists inventory_items_store_active_idx
  on public.inventory_items (store_id, is_active);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  display_name text not null,
  phone text,
  notes text,
  utang_balance numeric(12,2) not null default 0,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_display_name_not_blank check (btrim(display_name) <> '')
);

create unique index if not exists customers_store_display_name_unique
  on public.customers (store_id, lower(display_name))
  where archived_at is null;

create index if not exists customers_store_idx
  on public.customers (store_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  client_mutation_id text not null,
  source public.transaction_source not null default 'manual',
  raw_text text,
  local_parse jsonb not null default '{}'::jsonb,
  ai_parse jsonb not null default '{}'::jsonb,
  parser_source text,
  ai_model text,
  ai_confidence numeric(4,3),
  sync_status public.sync_status not null default 'pending',
  is_utang boolean not null default false,
  occurred_at timestamptz not null default now(),
  synced_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_client_mutation_id_not_blank check (btrim(client_mutation_id) <> ''),
  constraint transactions_ai_confidence_range check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  constraint transactions_unique_client_mutation unique (store_id, client_mutation_id)
);

create index if not exists transactions_store_occurred_at_idx
  on public.transactions (store_id, occurred_at desc);

create index if not exists transactions_store_sync_status_idx
  on public.transactions (store_id, sync_status);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  spoken_name text,
  quantity_delta numeric(12,3) not null,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) generated always as (round(abs(quantity_delta) * unit_price, 2)) stored,
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint transaction_items_quantity_delta_not_zero check (quantity_delta <> 0),
  constraint transaction_items_unit_price_non_negative check (unit_price >= 0)
);

create index if not exists transaction_items_transaction_idx
  on public.transaction_items (transaction_id);

create index if not exists transaction_items_store_item_idx
  on public.transaction_items (store_id, item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  transaction_item_id uuid references public.transaction_items(id) on delete set null,
  movement_type public.movement_type not null,
  quantity_delta numeric(12,3) not null,
  stock_after numeric(12,3),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  client_mutation_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_movements_quantity_delta_not_zero check (quantity_delta <> 0)
);

create unique index if not exists inventory_movements_store_client_mutation_unique
  on public.inventory_movements (store_id, client_mutation_id)
  where client_mutation_id is not null;

create index if not exists inventory_movements_store_item_occurred_at_idx
  on public.inventory_movements (store_id, item_id, occurred_at desc);

create table if not exists public.utang_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  entry_type public.utang_entry_type not null,
  amount_delta numeric(12,2) not null,
  balance_after numeric(12,2),
  note text,
  client_mutation_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint utang_entries_amount_delta_not_zero check (amount_delta <> 0)
);

create unique index if not exists utang_entries_store_client_mutation_unique
  on public.utang_entries (store_id, client_mutation_id)
  where client_mutation_id is not null;

create index if not exists utang_entries_store_customer_occurred_at_idx
  on public.utang_entries (store_id, customer_id, occurred_at desc);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  device_id text,
  client_batch_id text,
  status public.sync_status not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists sync_events_store_client_batch_unique
  on public.sync_events (store_id, client_batch_id)
  where client_batch_id is not null;

create index if not exists sync_events_store_started_at_idx
  on public.sync_events (store_id, started_at desc);

create table if not exists public.assistant_interactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  client_interaction_id text not null,
  question_text text not null,
  answer_text text,
  spoken_text text,
  actions jsonb not null default '[]'::jsonb,
  input_mode text not null default 'voice',
  output_mode text not null default 'text',
  model text,
  status public.assistant_interaction_status not null default 'pending',
  context_snapshot jsonb not null default '{}'::jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assistant_interactions_client_id_not_blank check (btrim(client_interaction_id) <> ''),
  constraint assistant_interactions_question_not_blank check (btrim(question_text) <> ''),
  constraint assistant_interactions_actions_array check (jsonb_typeof(actions) = 'array'),
  constraint assistant_interactions_input_mode_check check (input_mode in ('voice', 'text')),
  constraint assistant_interactions_output_mode_check check (output_mode in ('text', 'speech', 'text_and_speech')),
  constraint assistant_interactions_unique_client_interaction unique (store_id, client_interaction_id)
);

create index if not exists assistant_interactions_store_asked_at_idx
  on public.assistant_interactions (store_id, asked_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();

  insert into public.stores (owner_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'store_name', ''), 'My Store')
  )
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
as $$
declare
  next_stock numeric(12,3);
begin
  if not exists (
    select 1
    from public.inventory_items
    where id = new.item_id
      and store_id = new.store_id
  ) then
    raise exception 'Inventory item % does not belong to store %', new.item_id, new.store_id;
  end if;

  perform set_config('tindai.allow_stock_update', 'on', true);

  update public.inventory_items
  set current_stock = current_stock + new.quantity_delta,
      updated_at = now()
  where id = new.item_id
    and store_id = new.store_id
  returning current_stock into next_stock;

  perform set_config('tindai.allow_stock_update', 'off', true);

  new.stock_after = next_stock;
  return new;
end;
$$;

create or replace function public.prevent_direct_stock_update()
returns trigger
language plpgsql
as $$
begin
  if old.current_stock is distinct from new.current_stock
     and coalesce(current_setting('tindai.allow_stock_update', true), 'off') <> 'on' then
    raise exception 'Update stock through inventory_movements, not inventory_items.current_stock';
  end if;

  return new;
end;
$$;

create or replace function public.force_zero_initial_stock()
returns trigger
language plpgsql
as $$
begin
  -- Opening stock must be represented by an inventory movement for auditability.
  new.current_stock = 0;
  return new;
end;
$$;

drop trigger if exists inventory_items_force_zero_initial_stock on public.inventory_items;
create trigger inventory_items_force_zero_initial_stock
  before insert on public.inventory_items
  for each row execute function public.force_zero_initial_stock();

drop trigger if exists inventory_items_prevent_direct_stock_update on public.inventory_items;
create trigger inventory_items_prevent_direct_stock_update
  before update on public.inventory_items
  for each row execute function public.prevent_direct_stock_update();

drop trigger if exists inventory_movements_apply_stock on public.inventory_movements;
drop trigger if exists inventory_movements_20_apply_stock on public.inventory_movements;

create or replace function public.validate_assistant_interaction_refs()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null and not exists (
    select 1
    from public.stores
    where id = new.store_id
      and owner_id = new.user_id
  ) then
    raise exception 'User % does not own store %', new.user_id, new.store_id;
  end if;

  return new;
end;
$$;

drop trigger if exists assistant_interactions_validate_refs on public.assistant_interactions;
create trigger assistant_interactions_validate_refs
  before insert or update on public.assistant_interactions
  for each row execute function public.validate_assistant_interaction_refs();

create or replace function public.validate_transaction_customer()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is not null and not exists (
    select 1
    from public.customers
    where id = new.customer_id
      and store_id = new.store_id
  ) then
    raise exception 'Customer % does not belong to store %', new.customer_id, new.store_id;
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_validate_customer on public.transactions;
create trigger transactions_validate_customer
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_customer();

create or replace function public.validate_transaction_item_refs()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.transactions
    where id = new.transaction_id
      and store_id = new.store_id
  ) then
    raise exception 'Transaction % does not belong to store %', new.transaction_id, new.store_id;
  end if;

  if not exists (
    select 1
    from public.inventory_items
    where id = new.item_id
      and store_id = new.store_id
  ) then
    raise exception 'Inventory item % does not belong to store %', new.item_id, new.store_id;
  end if;

  return new;
end;
$$;

drop trigger if exists transaction_items_validate_refs on public.transaction_items;
create trigger transaction_items_validate_refs
  before insert or update on public.transaction_items
  for each row execute function public.validate_transaction_item_refs();

create or replace function public.validate_inventory_movement_refs()
returns trigger
language plpgsql
as $$
begin
  if new.transaction_id is not null and not exists (
    select 1
    from public.transactions
    where id = new.transaction_id
      and store_id = new.store_id
  ) then
    raise exception 'Transaction % does not belong to store %', new.transaction_id, new.store_id;
  end if;

  if new.transaction_item_id is not null and not exists (
    select 1
    from public.transaction_items
    where id = new.transaction_item_id
      and store_id = new.store_id
      and item_id = new.item_id
      and (new.transaction_id is null or transaction_id = new.transaction_id)
  ) then
    raise exception 'Transaction item % is not consistent with store %, item %, and transaction %',
      new.transaction_item_id, new.store_id, new.item_id, new.transaction_id;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_movements_validate_refs on public.inventory_movements;
drop trigger if exists inventory_movements_10_validate_refs on public.inventory_movements;
create trigger inventory_movements_10_validate_refs
  before insert or update on public.inventory_movements
  for each row execute function public.validate_inventory_movement_refs();

create trigger inventory_movements_20_apply_stock
  before insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

create or replace function public.apply_utang_entry()
returns trigger
language plpgsql
as $$
declare
  next_balance numeric(12,2);
begin
  if not exists (
    select 1
    from public.customers
    where id = new.customer_id
      and store_id = new.store_id
  ) then
    raise exception 'Customer % does not belong to store %', new.customer_id, new.store_id;
  end if;

  if new.transaction_id is not null and not exists (
    select 1
    from public.transactions
    where id = new.transaction_id
      and store_id = new.store_id
      and (customer_id is null or customer_id = new.customer_id)
  ) then
    raise exception 'Transaction % is not consistent with store % and customer %',
      new.transaction_id, new.store_id, new.customer_id;
  end if;

  perform set_config('tindai.allow_utang_balance_update', 'on', true);

  update public.customers
  set utang_balance = utang_balance + new.amount_delta,
      updated_at = now()
  where id = new.customer_id
    and store_id = new.store_id
  returning utang_balance into next_balance;

  perform set_config('tindai.allow_utang_balance_update', 'off', true);

  new.balance_after = next_balance;
  return new;
end;
$$;

create or replace function public.force_zero_initial_utang_balance()
returns trigger
language plpgsql
as $$
begin
  -- Opening balances must be represented by utang entries for auditability.
  new.utang_balance = 0;
  return new;
end;
$$;

drop trigger if exists customers_force_zero_initial_utang_balance on public.customers;
create trigger customers_force_zero_initial_utang_balance
  before insert on public.customers
  for each row execute function public.force_zero_initial_utang_balance();

create or replace function public.prevent_direct_utang_balance_update()
returns trigger
language plpgsql
as $$
begin
  if old.utang_balance is distinct from new.utang_balance
     and coalesce(current_setting('tindai.allow_utang_balance_update', true), 'off') <> 'on' then
    raise exception 'Update utang balance through utang_entries, not customers.utang_balance';
  end if;

  return new;
end;
$$;

drop trigger if exists customers_prevent_direct_utang_balance_update on public.customers;
create trigger customers_prevent_direct_utang_balance_update
  before update on public.customers
  for each row execute function public.prevent_direct_utang_balance_update();

drop trigger if exists utang_entries_apply_balance on public.utang_entries;
create trigger utang_entries_apply_balance
  before insert on public.utang_entries
  for each row execute function public.apply_utang_entry();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create or replace function public.user_owns_store(target_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.stores
    where id = target_store_id
      and owner_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.inventory_items enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.utang_entries enable row level security;
alter table public.sync_events enable row level security;
alter table public.assistant_interactions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "stores_select_own" on public.stores;
create policy "stores_select_own"
  on public.stores for select
  using (owner_id = auth.uid());

drop policy if exists "stores_insert_own" on public.stores;
create policy "stores_insert_own"
  on public.stores for insert
  with check (owner_id = auth.uid());

drop policy if exists "stores_update_own" on public.stores;
create policy "stores_update_own"
  on public.stores for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "inventory_items_select_own_store" on public.inventory_items;
create policy "inventory_items_select_own_store"
  on public.inventory_items for select
  using (public.user_owns_store(store_id));

drop policy if exists "inventory_items_insert_own_store" on public.inventory_items;
create policy "inventory_items_insert_own_store"
  on public.inventory_items for insert
  with check (public.user_owns_store(store_id));

drop policy if exists "inventory_items_update_own_store" on public.inventory_items;
create policy "inventory_items_update_own_store"
  on public.inventory_items for update
  using (public.user_owns_store(store_id))
  with check (public.user_owns_store(store_id));

drop policy if exists "inventory_items_delete_own_store" on public.inventory_items;

drop policy if exists "customers_select_own_store" on public.customers;
create policy "customers_select_own_store"
  on public.customers for select
  using (public.user_owns_store(store_id));

drop policy if exists "customers_insert_own_store" on public.customers;
create policy "customers_insert_own_store"
  on public.customers for insert
  with check (public.user_owns_store(store_id));

drop policy if exists "customers_update_own_store" on public.customers;
create policy "customers_update_own_store"
  on public.customers for update
  using (public.user_owns_store(store_id))
  with check (public.user_owns_store(store_id));

drop policy if exists "customers_delete_own_store" on public.customers;

drop policy if exists "transactions_select_own_store" on public.transactions;
create policy "transactions_select_own_store"
  on public.transactions for select
  using (public.user_owns_store(store_id));

drop policy if exists "transactions_insert_own_store" on public.transactions;

drop policy if exists "transactions_update_own_store" on public.transactions;

drop policy if exists "transaction_items_select_own_store" on public.transaction_items;
create policy "transaction_items_select_own_store"
  on public.transaction_items for select
  using (public.user_owns_store(store_id));

drop policy if exists "transaction_items_insert_own_store" on public.transaction_items;

drop policy if exists "inventory_movements_select_own_store" on public.inventory_movements;
create policy "inventory_movements_select_own_store"
  on public.inventory_movements for select
  using (public.user_owns_store(store_id));

drop policy if exists "inventory_movements_insert_own_store" on public.inventory_movements;

drop policy if exists "utang_entries_select_own_store" on public.utang_entries;
create policy "utang_entries_select_own_store"
  on public.utang_entries for select
  using (public.user_owns_store(store_id));

drop policy if exists "utang_entries_insert_own_store" on public.utang_entries;

drop policy if exists "sync_events_select_own_store" on public.sync_events;
create policy "sync_events_select_own_store"
  on public.sync_events for select
  using (public.user_owns_store(store_id));

drop policy if exists "sync_events_insert_own_store" on public.sync_events;

drop policy if exists "sync_events_update_own_store" on public.sync_events;

drop policy if exists "assistant_interactions_select_own_store" on public.assistant_interactions;
create policy "assistant_interactions_select_own_store"
  on public.assistant_interactions for select
  using (public.user_owns_store(store_id));

drop policy if exists "assistant_interactions_insert_own_store" on public.assistant_interactions;

create or replace view public.v_inventory_dashboard
with (security_invoker = true)
as
select
  i.id,
  i.store_id,
  i.name,
  i.category,
  i.unit,
  i.aliases,
  i.price,
  i.current_stock,
  i.low_stock_threshold,
  (i.current_stock <= i.low_stock_threshold) as is_low_stock,
  i.is_active,
  i.updated_at
from public.inventory_items i
where i.archived_at is null;

create or replace view public.v_daily_sales_summary
with (security_invoker = true)
as
select
  t.store_id,
  date_trunc('day', t.occurred_at)::date as sale_date,
  count(distinct t.id) filter (where im.movement_type in ('sale', 'utang_sale')) as transaction_count,
  coalesce(sum(round(abs(im.quantity_delta) * ti.unit_price, 2)) filter (where im.movement_type in ('sale', 'utang_sale')), 0)::numeric(12,2) as gross_sales,
  coalesce(sum(abs(im.quantity_delta)) filter (where im.movement_type in ('sale', 'utang_sale')), 0)::numeric(12,3) as units_sold,
  count(distinct t.id) filter (where t.is_utang) as utang_transaction_count
from public.transactions t
left join public.transaction_items ti on ti.transaction_id = t.id
left join public.inventory_movements im on im.transaction_item_id = ti.id
group by t.store_id, date_trunc('day', t.occurred_at)::date;

grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.stores to authenticated;
grant select, insert, update on public.inventory_items to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select on public.transactions to authenticated;
grant select on public.transaction_items to authenticated;
grant select on public.inventory_movements to authenticated;
grant select on public.utang_entries to authenticated;
grant select on public.sync_events to authenticated;
grant select on public.assistant_interactions to authenticated;

grant select on public.v_inventory_dashboard to authenticated;
grant select on public.v_daily_sales_summary to authenticated;

revoke execute on function public.user_owns_store(uuid) from public;
revoke execute on function public.user_owns_store(uuid) from anon;
grant execute on function public.user_owns_store(uuid) to authenticated;

comment on table public.inventory_items is 'Dynamic inventory catalog for each user-owned store. Demo items should be seed data, not hardcoded schema assumptions.';
comment on table public.inventory_movements is 'Immutable inventory ledger. Insert rows here to change cached inventory_items.current_stock.';
comment on table public.transactions is 'One user action or synced command. client_mutation_id makes offline retries idempotent per store.';
comment on table public.utang_entries is 'Immutable customer credit ledger. Positive amount_delta increases utang, negative amount_delta records payment or reversal.';
comment on table public.assistant_interactions is 'Read-only conversational assistant log for online question intent. Backend writes rows with service role; mobile can read its store history. actions must remain advisory/empty for MVP.';

create or replace function public.seed_demo_store(
  p_store_id uuid,
  p_actor_user_id uuid default null,
  p_replace_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_item_id uuid;
  v_item record;
  v_created_items integer := 0;
  v_updated_items integer := 0;
  v_seeded_movements integer := 0;
begin
  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
  ) then
    raise exception 'Store % does not exist', p_store_id;
  end if;

  if p_replace_existing then
    update public.inventory_items
    set archived_at = v_now,
        is_active = false,
        updated_at = v_now
    where store_id = p_store_id
      and archived_at is null;
  end if;

  create temporary table _seed_inventory (
    name text not null,
    category text,
    unit text not null,
    price numeric(12,2) not null,
    low_stock_threshold numeric(12,3) not null,
    opening_stock numeric(12,3) not null,
    aliases text[] not null
  ) on commit drop;

  insert into _seed_inventory (name, category, unit, price, low_stock_threshold, opening_stock, aliases)
  values
    ('Coke Mismo', 'drinks', 'pcs', 20, 5, 12, array['coke', 'coke mismo', 'coca cola']),
    ('Safeguard', 'toiletries', 'pcs', 28, 5, 6, array['safeguard', 'safeguard soap']),
    ('Century Tuna', 'canned goods', 'pcs', 38, 4, 8, array['century tuna', 'tuna']),
    ('Rice', 'staples', 'kg', 55, 10, 25, array['rice', 'bigas']),
    ('Eggs', 'staples', 'pcs', 9, 12, 30, array['eggs', 'itlog']);

  for v_item in
    select *
    from _seed_inventory
  loop
    select i.id
    into v_item_id
    from public.inventory_items i
    where i.store_id = p_store_id
      and i.archived_at is null
      and lower(i.name) = lower(v_item.name)
    limit 1;

    if v_item_id is null then
      insert into public.inventory_items (
        store_id,
        name,
        category,
        unit,
        aliases,
        price,
        low_stock_threshold,
        is_active,
        metadata
      )
      values (
        p_store_id,
        v_item.name,
        v_item.category,
        v_item.unit,
        v_item.aliases,
        v_item.price,
        v_item.low_stock_threshold,
        true,
        jsonb_build_object('seeded_by', 'seed_demo_store', 'seeded_at', v_now)
      )
      returning id into v_item_id;

      v_created_items := v_created_items + 1;
    else
      update public.inventory_items
      set category = v_item.category,
          unit = v_item.unit,
          aliases = v_item.aliases,
          price = v_item.price,
          low_stock_threshold = v_item.low_stock_threshold,
          is_active = true,
          updated_at = v_now,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('seeded_by', 'seed_demo_store', 'seeded_at', v_now)
      where id = v_item_id;

      v_updated_items := v_updated_items + 1;
    end if;

    insert into public.inventory_movements (
      store_id,
      item_id,
      movement_type,
      quantity_delta,
      reason,
      created_by,
      client_mutation_id,
      occurred_at,
      metadata
    )
    values (
      p_store_id,
      v_item_id,
      'opening_stock',
      v_item.opening_stock,
      'Demo seed opening stock',
      p_actor_user_id,
      format('seed_opening_stock:%s', v_item_id::text),
      v_now,
      jsonb_build_object('seeded_by', 'seed_demo_store')
    )
    on conflict (store_id, client_mutation_id) do nothing;

    if found then
      v_seeded_movements := v_seeded_movements + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'store_id', p_store_id,
    'replace_existing', p_replace_existing,
    'created_items', v_created_items,
    'updated_items', v_updated_items,
    'opening_stock_movements_inserted', v_seeded_movements
  );
end;
$$;

revoke execute on function public.seed_demo_store(uuid, uuid, boolean) from public;
revoke execute on function public.seed_demo_store(uuid, uuid, boolean) from anon;
revoke execute on function public.seed_demo_store(uuid, uuid, boolean) from authenticated;
grant execute on function public.seed_demo_store(uuid, uuid, boolean) to service_role;

comment on function public.seed_demo_store(uuid, uuid, boolean) is 'Backend-only helper for /api/demo/seed-store. Idempotently seeds demo inventory and opening-stock ledger entries for a store.';
