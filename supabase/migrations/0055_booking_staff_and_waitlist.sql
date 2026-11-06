-- 0055: standalone self-service calendar — staff members (multi-provider
-- scheduling with per-staff weekly hours + service assignment), per-staff
-- slot uniqueness (replaces the single-resource unique constraint), and a
-- cancellation waitlist.

-- Staff members (providers/resources). hours=null → inherit business hours.
create table public.booking_staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  role_title text,
  color text,
  hours jsonb,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.booking_staff enable row level security;

create policy "booking_staff_owner_all" on public.booking_staff
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index booking_staff_business_idx
  on public.booking_staff (business_id, active, sort);

-- Staff ↔ service assignment. No rows for a staff member = offers all services.
create table public.booking_staff_services (
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid not null references public.booking_staff(id) on delete cascade,
  service_id uuid not null references public.booking_services(id) on delete cascade,
  primary key (staff_id, service_id)
);

alter table public.booking_staff_services enable row level security;

create policy "booking_staff_services_owner_all" on public.booking_staff_services
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index booking_staff_services_business_idx
  on public.booking_staff_services (business_id);

-- Bookings: staff link. staff_key ('' when unassigned) lets the per-staff
-- unique index treat NULL staff as a single shared resource, preserving the
-- legacy one-booking-per-instant behavior for businesses without staff.
alter table public.bookings
  add column if not exists staff_id uuid references public.booking_staff(id) on delete set null,
  add column if not exists staff_key text generated always as (coalesce(staff_id::text, '')) stored;

alter table public.bookings drop constraint if exists bookings_business_id_starts_at_key;

create unique index bookings_business_staff_start_key
  on public.bookings (business_id, staff_key, starts_at);

create index bookings_staff_time_idx
  on public.bookings (business_id, staff_id, starts_at)
  where staff_id is not null;

-- Waitlist: customers who want a slot on a full day; notified on cancellation.
create table public.booking_waitlist (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.booking_services(id) on delete cascade,
  staff_id uuid references public.booking_staff(id) on delete cascade,
  date date not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  status text not null default 'waiting' check (status in ('waiting','notified','booked','expired')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.booking_waitlist enable row level security;

create policy "booking_waitlist_owner_all" on public.booking_waitlist
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index booking_waitlist_business_date_idx
  on public.booking_waitlist (business_id, date, status);
