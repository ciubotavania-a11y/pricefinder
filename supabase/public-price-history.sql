-- Allow visitors to view price history only for offers that are currently active.
-- Run once in Supabase SQL Editor after automatic-sync.sql.
drop policy if exists "Public read active offer price history" on public.price_history;
create policy "Public read active offer price history" on public.price_history
for select to anon, authenticated
using (
  exists (
    select 1
    from public.offers
    where offers.id = price_history.offer_id
      and offers.active = true
  )
);
