-- Vacation-rental / צימר ("תזמון לילות"): multiple bookable units, each with
-- its own availability calendar + nightly price; date-range reservations that
-- block overlapping dates.

create table if not exists rental_units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  nightly_price numeric not null default 0,
  max_guests int not null default 2,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_rental_units_business on rental_units(business_id);

create table if not exists rental_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  unit_id uuid not null references rental_units(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  guest_name text,
  guest_phone text,
  guest_email text,
  guests int not null default 1,
  nights int not null default 1,
  total numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded','failed')),
  paid_at timestamptz,
  customer_user_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  constraint rental_bookings_dates check (check_out > check_in)
);
create index if not exists idx_rental_bookings_unit on rental_bookings(unit_id, check_in, check_out);
create index if not exists idx_rental_bookings_business on rental_bookings(business_id);
create index if not exists idx_rental_bookings_customer on rental_bookings(customer_user_id);

alter table rental_units enable row level security;
alter table rental_bookings enable row level security;

create policy rental_units_owner_all on rental_units
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy rental_bookings_owner_all on rental_bookings
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy rental_bookings_customer_select on rental_bookings
  for select using (customer_user_id = auth.uid());
