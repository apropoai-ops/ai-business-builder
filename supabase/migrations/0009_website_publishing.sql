-- ============================================================================
--  Migration 0009 — Website Publishing (completes M4 from the masterplan)
--  Adds slug + published to websites. Public pages are served at /s/[slug]
--  via a server-side service-role read scoped to published=true (no anon RLS).
-- ============================================================================

alter table public.websites
  add column if not exists slug      text,
  add column if not exists published boolean not null default false;

-- Unique slug across all published sites.
create unique index if not exists idx_websites_slug on public.websites(slug)
  where slug is not null;
