-- PriceFinder automatic feed sync foundation.
-- Run once in Supabase SQL Editor after the existing schema and admin-security scripts.

alter table public.retailers
  add column if not exists feed_url text,
  add column if not exists feed_format text check (feed_format in ('csv','xml','json','api')),
  add column if not exists field_mapping jsonb not null default '{}'::jsonb,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_sync_status text,
  add column if not exists last_sync_message text;

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','success','partial','failed')),
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text
);

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.offers(id) on delete cascade,
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  price numeric(12,2) not null,
  currency text not null default 'MDL',
  recorded_at timestamptz not null default now()
);

create index if not exists sync_runs_retailer_started_idx
  on public.sync_runs(retailer_id, started_at desc);
create index if not exists price_history_offer_recorded_idx
  on public.price_history(offer_id, recorded_at desc);

-- The sync worker needs a stable key for safe insert/update instead of duplicates.
do $$
begin
  if exists (
    select 1 from public.offers
    group by retailer_id, product_url
    having count(*) > 1
  ) then
    raise exception 'Duplicate retailer_id + product_url rows exist in offers. Resolve duplicates before enabling automatic sync.';
  end if;
end $$;

create unique index if not exists offers_retailer_product_url_uidx
  on public.offers(retailer_id, product_url);

create or replace function public.record_offer_price_change()
returns trigger
language plpgsql
as $$
begin
  if old.price is distinct from new.price or old.currency is distinct from new.currency then
    insert into public.price_history(offer_id, retailer_id, price, currency)
    values (new.id, new.retailer_id, new.price, new.currency);
  end if;
  return new;
end;
$$;

drop trigger if exists offers_price_history_trigger on public.offers;
create trigger offers_price_history_trigger
after update of price, currency on public.offers
for each row execute function public.record_offer_price_change();

create or replace function public.record_initial_offer_price()
returns trigger
language plpgsql
as $$
begin
  insert into public.price_history(offer_id, retailer_id, price, currency)
  values (new.id, new.retailer_id, new.price, new.currency);
  return new;
end;
$$;

drop trigger if exists offers_initial_price_history_trigger on public.offers;
create trigger offers_initial_price_history_trigger
after insert on public.offers
for each row execute function public.record_initial_offer_price();

alter table public.sync_runs enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "Admins read sync runs" on public.sync_runs;
create policy "Admins read sync runs" on public.sync_runs
for select to authenticated using (public.is_pricefinder_admin());

drop policy if exists "Admins read price history" on public.price_history;
create policy "Admins read price history" on public.price_history
for select to authenticated using (public.is_pricefinder_admin());

-- service_role used only by the private scheduled worker bypasses RLS.
