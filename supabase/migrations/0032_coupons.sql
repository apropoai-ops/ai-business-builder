-- ============================================================================
--  Migration 0032 — store discount coupons. Applied via MCP.
--  type: 'percent' (value = %) or 'fixed' (value = ₪ off). min_order optional.
--  Owner RLS; public validation happens via service-role code paths.
-- ============================================================================

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  type text not null default 'percent' check (type in ('percent','fixed')),
  value numeric not null check (value >= 0),
  min_order numeric,
  active boolean not null default true,
  expires_at date,
  used_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);
create index if not exists idx_coupons_business on public.coupons (business_id);

alter table public.coupons enable row level security;
create policy "coupons_owner_all" on public.coupons
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
