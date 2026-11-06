-- 0063: integrations hub core — a single generic credentials store
-- (business_integrations) shared by every third-party connector that isn't
-- already its own table (payment gateways have store_payment_connections;
-- WhatsApp has whatsapp_config). Also adds email_log (per-send audit trail
-- for the Resend-backed email service) and per-business email sender
-- customization columns.

-- One row per (business, provider) connection. credentials_enc is an
-- AES-256-GCM blob (see lib/services/integrations/credentials.ts) — never
-- stored in plaintext. category groups providers for the UI ('invoicing',
-- 'sms', 'other').
create table if not exists public.business_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  category text not null,
  credentials_enc text not null,
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

alter table public.business_integrations enable row level security;

drop policy if exists "business_integrations_owner_all" on public.business_integrations;
create policy "business_integrations_owner_all" on public.business_integrations
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index if not exists business_integrations_business_idx
  on public.business_integrations (business_id, category);

-- Per-send audit trail for the email service (lib/services/email.service.ts).
-- business_id is nullable — a few sends (e.g. plan welcome emails) aren't
-- tied to a single business — those rows are only visible via service role.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  to_email text not null,
  subject text not null,
  kind text not null,
  status text not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.email_log enable row level security;

drop policy if exists "email_log_owner_read" on public.email_log;
create policy "email_log_owner_read" on public.email_log
  for select
  using (business_id is not null and public.is_business_owner(business_id));

create index if not exists email_log_business_idx
  on public.email_log (business_id, created_at desc)
  where business_id is not null;

-- Per-business email sender customization (used by email.service.ts to build
-- the From display name + Reply-To header).
alter table public.businesses
  add column if not exists email_from_name text,
  add column if not exists email_reply_to text;
