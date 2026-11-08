-- Enable cautious discovery of public product pages for stores whose terms permit it.
alter table public.retailers
  add column if not exists public_crawl_enabled boolean not null default false;

comment on column public.retailers.public_crawl_enabled is
  'Enable PriceFinder public-page discovery only after checking retailer terms and robots.txt. Never bypass access controls.';
