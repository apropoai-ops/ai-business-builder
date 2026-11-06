-- 0060: tasks become first-class (status/priority/staff assignee/standalone),
-- internal calendar events (personal appointments etc. alongside bookings),
-- and a live ICS feed token for the booking calendar.

-- Tasks: status lifecycle (kept in sync with the legacy `done` boolean),
-- priority, staff assignee, and standalone tasks (no parent project).
alter table public.project_tasks
  add column if not exists status text not null default 'open'
    check (status in ('open', 'in_progress', 'done')),
  add column if not exists priority text
    check (priority in ('low', 'normal', 'high')),
  add column if not exists staff_id uuid references public.booking_staff(id) on delete set null;

-- Backfill status from the existing `done` boolean for pre-existing rows.
update public.project_tasks set status = 'done' where done = true and status <> 'done';

alter table public.project_tasks alter column project_id drop not null;

create index if not exists project_tasks_business_status_idx
  on public.project_tasks (business_id, status, due_date);
create index if not exists project_tasks_staff_idx
  on public.project_tasks (staff_id)
  where staff_id is not null;

-- Internal calendar events (personal appointments etc.) — rendered alongside
-- bookings on the week/month views, optionally tied to a staff member.
create table if not exists public.business_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid references public.booking_staff(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.business_events enable row level security;

drop policy if exists "business_events_owner_all" on public.business_events;
create policy "business_events_owner_all" on public.business_events
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index if not exists business_events_business_time_idx
  on public.business_events (business_id, starts_at, ends_at);
create index if not exists business_events_staff_idx
  on public.business_events (staff_id)
  where staff_id is not null;

-- Per-business token for the public live ICS feed (webcal:// subscription).
alter table public.booking_settings
  add column if not exists ics_feed_token uuid not null default gen_random_uuid();
