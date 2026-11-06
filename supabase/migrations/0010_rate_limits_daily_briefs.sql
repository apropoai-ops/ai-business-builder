-- ============================================================================
--  Migration 0010 — Rate limiting + Proactive AI CEO daily briefs
-- ============================================================================

-- ── rate_limits: fixed-window counters, accessed only via the RPC below ────
create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table public.rate_limits enable row level security; -- no policies: service-role only

create or replace function public.bump_rate_limit(
  p_key text, p_limit int, p_window_seconds int
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare allowed boolean;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then 1 else rate_limits.count + 1 end,
    window_start = case
      when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then now() else rate_limits.window_start end;

  select count <= p_limit into allowed from rate_limits where key = p_key;
  return allowed;
end $$;

revoke all on function public.bump_rate_limit(text, int, int) from public, anon, authenticated;

-- ── daily_briefs: the proactive AI CEO morning brief (one per day) ─────────
create table if not exists public.daily_briefs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  brief_date  date not null default current_date,
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (business_id, brief_date)
);
alter table public.daily_briefs enable row level security;

-- Owner can read; writes happen server-side (cron / action via service role).
drop policy if exists "daily_briefs_owner_read" on public.daily_briefs;
create policy "daily_briefs_owner_read" on public.daily_briefs
  for select using (public.is_business_owner(business_id));
