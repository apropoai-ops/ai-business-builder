-- ============================================================================
--  Migration 0030 — self-service bookings (auto-confirm). Applied via MCP.
--  When booking_settings.auto_confirm is true, public bookings are created
--  already 'confirmed' (no owner approval) and the owner gets an informational
--  CRM task instead of a "please approve" task.
-- ============================================================================

alter table public.booking_settings
  add column if not exists auto_confirm boolean not null default false;
