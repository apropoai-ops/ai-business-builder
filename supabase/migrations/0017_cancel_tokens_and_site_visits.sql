-- ============================================================================
--  Migration 0017 — feature-wave foundation (applied via MCP).
--  bookings.cancel_token: public self-service cancellation links.
--  site_visits: lightweight public-site analytics (service-role inserts,
--  owner-only reads).
-- ============================================================================

alter table public.bookings add column if not exists cancel_token uuid not null default gen_random_uuid();
create unique index if not exists idx_bookings_cancel_token on public.bookings (cancel_token);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null,
  referrer text,
  created_at timestamptz not null default now()
);
create index if not exists idx_site_visits_business_time on public.site_visits (business_id, created_at);
alter table public.site_visits enable row level security;
create policy "site_visits_owner_read" on public.site_visits
  for select using (is_business_owner(business_id));
