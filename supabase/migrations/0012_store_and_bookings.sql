-- ============================================================================
--  Migration 0012 — Store (products) + Booking system (applied via MCP).
--  products · booking_settings · bookings (unique slot per business).
--  Owner RLS on all three; public reads go through service-role code paths
--  scoped to published sites.
-- ============================================================================
-- (Full SQL applied remotely; see git history of this file's PR for details.)

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  enabled boolean not null default false,
  slot_minutes int not null default 60,
  days_ahead int not null default 14,
  hours jsonb,
  services jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  service text,
  starts_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  unique (business_id, starts_at)
);
