-- Product identifiers improve cross-store product matching and catalog quality.
alter table public.offers
  add column if not exists brand text,
  add column if not exists sku text,
  add column if not exists gtin text;

create index if not exists offers_gtin_idx on public.offers(gtin) where gtin is not null;
create index if not exists offers_brand_idx on public.offers(brand) where brand is not null;
