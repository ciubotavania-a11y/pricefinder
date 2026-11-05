-- Store only short factual product attributes supplied in the source feed.
alter table public.offers
  add column if not exists specifications jsonb not null default '{}'::jsonb;

comment on column public.offers.specifications is
  'Short factual product attributes (for example RAM, storage, dimensions); do not store copied marketing descriptions.';
