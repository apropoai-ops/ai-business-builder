-- ============================================================================
--  Migration 0052 — Merchant payment-gateway connections.
--  Lets a store owner connect their OWN Israeli payment provider (Grow,
--  Cardcom, Tranzila, PayPlus, Pelecard, iCredit) so storefront card payments
--  are charged directly to the merchant's account. Credentials are stored
--  AES-256-GCM encrypted (key in PAYMENTS_ENC_KEY env, never in the DB).
--  Owner may read their rows (encrypted blob is useless without the app key);
--  all writes go through service-role server code.
-- ============================================================================

create table if not exists public.store_payment_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  credentials_encrypted text,
  enabled boolean not null default false,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

create index if not exists store_payment_connections_business_id_idx
  on public.store_payment_connections (business_id);

alter table public.store_payment_connections enable row level security;

create policy "store_payment_connections_owner_read"
  on public.store_payment_connections
  for select using (is_business_owner(business_id));
