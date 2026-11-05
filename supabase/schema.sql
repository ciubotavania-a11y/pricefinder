-- PriceFinder.md database schema for Supabase (PostgreSQL)
create extension if not exists pgcrypto;

create table if not exists public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website text not null,
  kind text not null check (kind in ('store','marketplace')),
  integration_type text not null default 'manual' check (integration_type in ('manual','csv','xml','json','api')),
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id),
  title text not null,
  description text,
  category text not null,
  condition text not null check (condition in ('new','used')),
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'MDL',
  product_url text not null,
  image_url text,
  verified boolean not null default false,
  sponsored boolean not null default false,
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_search_idx on public.offers using gin (to_tsvector('simple', title));
create index if not exists offers_price_idx on public.offers(price);
create index if not exists offers_category_idx on public.offers(category);
create index if not exists offers_condition_idx on public.offers(condition);
create index if not exists offers_retailer_idx on public.offers(retailer_id);

alter table public.retailers enable row level security;
alter table public.categories enable row level security;
alter table public.offers enable row level security;

-- Public can read enabled retailers, categories and active offers only.
create policy "Public read enabled retailers" on public.retailers for select using (enabled = true);
create policy "Public read categories" on public.categories for select using (true);
create policy "Public read active offers" on public.offers for select using (active = true);

-- Authenticated writes are restricted to the configured admin email.
create policy "Admin manages retailers" on public.retailers for all to authenticated
using ((auth.jwt()->>'email') = current_setting('app.admin_email', true))
with check ((auth.jwt()->>'email') = current_setting('app.admin_email', true));
create policy "Admin manages offers" on public.offers for all to authenticated
using ((auth.jwt()->>'email') = current_setting('app.admin_email', true))
with check ((auth.jwt()->>'email') = current_setting('app.admin_email', true));

insert into public.categories(slug,name) values
('telefoane','Telefoane'),('calculatoare','Calculatoare și laptopuri'),
('televizoare','Televizoare'),('electrocasnice','Electrocasnice'),
('auto','Auto și piese'),('mobilier','Mobilier'),('moda','Modă și încălțăminte'),
('sport','Sport și recreere'),('copii','Produse pentru copii'),('diverse','Altele')
on conflict (slug) do nothing;

insert into public.retailers(name,website,kind,integration_type,notes) values
('Darwin','https://darwin.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Enter','https://enter.online','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Maximum','https://maximum.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Smart','https://smart.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('PandaShop','https://www.pandashop.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Ultra','https://ultra.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Bomba','https://bomba.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Cactus','https://cactus.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('GSMShop','https://gsmshop.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('Xstore','https://xstore.md','store','manual','Integrare doar prin feed/API sau acord autorizat'),
('999.md','https://999.md','marketplace','manual','Acces API/permisiune necesară pentru import'),
('Makler.md','https://makler.md','marketplace','manual','Import numai cu permisiune/feed disponibil')
on conflict (name) do nothing;
