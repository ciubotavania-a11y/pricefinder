-- PriceFinder.md: secure administrator access for Supabase RLS.
-- Run this AFTER supabase/schema.sql and AFTER creating the admin user in Supabase Auth.
-- Replace ADMIN_EMAIL_HERE with the exact administrator email before running.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_pricefinder_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_pricefinder_admin() from public;
grant execute on function public.is_pricefinder_admin() to authenticated;

drop policy if exists "Admin manages retailers" on public.retailers;
create policy "Admin manages retailers"
on public.retailers
for all
to authenticated
using (public.is_pricefinder_admin())
with check (public.is_pricefinder_admin());

drop policy if exists "Admin manages offers" on public.offers;
create policy "Admin manages offers"
on public.offers
for all
to authenticated
using (public.is_pricefinder_admin())
with check (public.is_pricefinder_admin());

-- Register the existing Auth user as an administrator.
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('ADMIN_EMAIL_HERE')
on conflict (user_id) do nothing;
