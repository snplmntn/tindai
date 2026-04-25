-- Add missing avatar_url column used by the backend profile model.
alter table if exists public.profiles
  add column if not exists avatar_url text;
