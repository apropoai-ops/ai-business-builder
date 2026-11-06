-- ============================================================================
--  Migration 0005 — Content Calendar (Phase 2, Feature 2)
--  calendar_entries — scheduled content ideas per business.
-- ============================================================================

-- Add content_calendar to the job_type enum
do $$ begin
  alter type job_type add value if not exists 'content_calendar';
exception when others then null; end $$;

create table if not exists public.calendar_entries (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  scheduled_for date not null,
  platform     text not null,   -- instagram | facebook | linkedin | tiktok | blog | email
  content_type text not null,   -- post | reel | story | article | newsletter
  title        text not null,
  idea         text,            -- short description of the content idea
  status       text not null default 'planned',  -- planned | published
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_calendar_entries_business on public.calendar_entries(business_id, scheduled_for);

drop trigger if exists trg_calendar_entries_updated_at on public.calendar_entries;
create trigger trg_calendar_entries_updated_at
  before update on public.calendar_entries
  for each row execute function public.set_updated_at();

alter table public.calendar_entries enable row level security;

drop policy if exists "calendar_entries_owner" on public.calendar_entries;
create policy "calendar_entries_owner" on public.calendar_entries
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
