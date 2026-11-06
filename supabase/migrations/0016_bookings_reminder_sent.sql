-- ============================================================================
--  Migration 0016 — appointment reminders (applied via MCP).
--  reminder_sent_at marks that a reminder action (WhatsApp message or CRM
--  task for the owner) was already taken for this booking, so the daily
--  cron never reminds twice.
-- ============================================================================

alter table public.bookings add column if not exists reminder_sent_at timestamptz;
