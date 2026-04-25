create table if not exists public.receipt_products (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  category text,
  unit text,
  constraint receipt_products_code_not_blank check (btrim(code) <> ''),
  constraint receipt_products_name_not_blank check (btrim(name) <> '')
);

create index if not exists receipt_products_category_idx
  on public.receipt_products (category);

comment on table public.receipt_products is
  'Centralized product list for receipt code matching and name standardization.';
