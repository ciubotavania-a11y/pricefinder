-- Legal gate for all retailer feed imports.
-- Run in Supabase SQL Editor. Existing retailers remain unauthorized by default.
alter table public.retailers
  add column if not exists feed_authorized boolean not null default false,
  add column if not exists feed_authorization_note text,
  add column if not exists feed_authorized_at timestamptz;

comment on column public.retailers.feed_authorized is
  'Enable only after documented permission or an applicable official feed/API license has been verified.';
comment on column public.retailers.feed_authorization_note is
  'Internal reference to permission, contract, or feed terms; do not store credentials here.';
