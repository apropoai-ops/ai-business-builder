-- 0054: professional scheduling (services w/ duration+price, overlap-aware
-- bookings, buffers/notice windows, recurring appointments, customer linkage)
-- + CRM customer enrichment (tags, birthday).

-- Real bookable services (replaces the legacy JSON name list in booking_settings.services)
create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 30,
  price numeric,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.booking_services enable row level security;

create policy "booking_services_owner_all" on public.booking_services
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index booking_services_business_idx
  on public.booking_services (business_id, active, sort);

-- Bookings: duration/end, service link, email, no-show, recurrence, account link
alter table public.bookings
  add column if not exists service_id uuid references public.booking_services(id) on delete set null,
  add column if not exists duration_minutes integer,
  add column if not exists ends_at timestamptz,
  add column if not exists customer_email text,
  add column if not exists no_show boolean not null default false,
  add column if not exists recurrence text,
  add column if not exists recurrence_group uuid,
  add column if not exists customer_user_id uuid;

-- Best-effort backfill so overlap checks have an end for legacy rows.
update public.bookings
  set ends_at = starts_at + interval '30 minutes'
  where ends_at is null;

create index if not exists bookings_business_time_idx
  on public.bookings (business_id, starts_at, ends_at);
create index if not exists bookings_customer_user_idx
  on public.bookings (customer_user_id)
  where customer_user_id is not null;
create index if not exists bookings_recurrence_group_idx
  on public.bookings (recurrence_group)
  where recurrence_group is not null;

-- Scheduling policy knobs
alter table public.booking_settings
  add column if not exists buffer_minutes integer not null default 0,
  add column if not exists min_notice_hours integer not null default 0,
  add column if not exists cancel_notice_hours integer not null default 2;

-- CRM customer enrichment
alter table public.crm_customers
  add column if not exists tags text[],
  add column if not exists birthday date;
