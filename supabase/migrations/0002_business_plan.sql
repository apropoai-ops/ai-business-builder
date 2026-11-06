-- ============================================================================
--  Migration 0002 — Business Plan (M1)
--  business_profiles (F1 output), jobs (async queue), agent_logs (AI audit).
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type job_status as enum ('queued', 'running', 'succeeded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_type as enum ('business_plan', 'market_research', 'branding', 'website');
exception when duplicate_object then null; end $$;

-- ============================================================================
--  business_profiles — the generated business plan (1:1 with business)
-- ============================================================================
create table if not exists public.business_profiles (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null unique references public.businesses(id) on delete cascade,
  executive_summary text,
  business_model    jsonb,
  value_proposition text,
  revenue_streams   jsonb,
  customer_segments jsonb,
  pricing_strategy  jsonb,
  launch_plan       jsonb,
  generated_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_business_profiles_updated_at on public.business_profiles;
create trigger trg_business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
--  jobs — async work queue for heavy AI generation
-- ============================================================================
create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type        job_type not null,
  status      job_status not null default 'queued',
  payload     jsonb,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_jobs_business on public.jobs(business_id);
create index if not exists idx_jobs_status on public.jobs(status);

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ============================================================================
--  agent_logs — audit trail for every AI call (tokens, cost, latency)
-- ============================================================================
create table if not exists public.agent_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  agent       text not null,
  provider    text,
  model       text,
  tokens_in   int,
  tokens_out  int,
  cost_usd    numeric,
  latency_ms  int,
  status      text,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_agent_logs_business on public.agent_logs(business_id);

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.business_profiles enable row level security;
alter table public.jobs              enable row level security;
alter table public.agent_logs        enable row level security;

drop policy if exists "business_profiles_owner" on public.business_profiles;
create policy "business_profiles_owner" on public.business_profiles
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists "jobs_owner" on public.jobs;
create policy "jobs_owner" on public.jobs
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- agent_logs: owner can read; writes happen server-side (owner context or service role).
drop policy if exists "agent_logs_owner_read" on public.agent_logs;
create policy "agent_logs_owner_read" on public.agent_logs
  for select using (public.is_business_owner(business_id));

drop policy if exists "agent_logs_owner_insert" on public.agent_logs;
create policy "agent_logs_owner_insert" on public.agent_logs
  for insert with check (
    business_id is null or public.is_business_owner(business_id)
  );
