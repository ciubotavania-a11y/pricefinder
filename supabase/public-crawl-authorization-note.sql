-- Evidence note for retailer-specific public catalog discovery.
alter table public.retailers
  add column if not exists public_crawl_authorization_note text;

comment on column public.retailers.public_crawl_authorization_note is
  'Admin-recorded reference for checking whether automated access to public product pages is permitted. This note does not itself grant permission.';
