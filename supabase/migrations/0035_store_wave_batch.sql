-- ============================================================================
--  Migration 0035 — central batch for the parallel multi-agent store wave.
--  returns, newsletter_subscribers; businesses.announcement_bar + size_guide;
--  reviews.image_url + verified; coupons.max_uses. Applied via MCP.
-- ============================================================================

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  item text,
  reason text,
  kind text not null default 'return' check (kind in ('return','exchange')),
  status text not null default 'new' check (status in ('new','approved','rejected','done')),
  created_at timestamptz not null default now()
);
create index if not exists idx_returns_business on public.returns (business_id, status, created_at);
alter table public.returns enable row level security;
create policy "returns_owner_all" on public.returns
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);
create index if not exists idx_newsletter_business on public.newsletter_subscribers (business_id, created_at);
alter table public.newsletter_subscribers enable row level security;
create policy "newsletter_owner_all" on public.newsletter_subscribers
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

alter table public.businesses
  add column if not exists announcement_bar text,
  add column if not exists size_guide jsonb;

alter table public.reviews
  add column if not exists image_url text,
  add column if not exists verified boolean not null default false;

alter table public.coupons
  add column if not exists max_uses int;
