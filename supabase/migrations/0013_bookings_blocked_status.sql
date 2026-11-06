-- ============================================================================
--  Migration 0013 — allow 'blocked' booking status (applied via MCP).
--  Owners can block slots manually (vacation, breaks); blocked rows occupy
--  the unique (business_id, starts_at) slot so the public widget hides them.
-- ============================================================================

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending','confirmed','cancelled','blocked'));
