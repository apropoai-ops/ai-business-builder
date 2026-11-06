-- ============================================================================
--  Migration 0015 — Realtime on jobs (applied via MCP).
--  Lets the dashboard subscribe to job status changes instead of polling.
--  postgres_changes respects the existing jobs_owner RLS policy.
-- ============================================================================

alter publication supabase_realtime add table public.jobs;
