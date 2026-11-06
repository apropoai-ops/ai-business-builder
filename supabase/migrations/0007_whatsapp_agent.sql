-- ============================================================================
--  Migration 0007 — WhatsApp AI Agent (Phase 2, Feature 4)
--  whatsapp_config — configurable AI agent for leads, bookings, FAQ, sales.
-- ============================================================================

do $$ begin
  alter type job_type add value if not exists 'whatsapp';
exception when others then null; end $$;

create table if not exists public.whatsapp_config (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null unique references public.businesses(id) on delete cascade,
  greeting     text,
  tone         text,
  goals        jsonb,   -- string[]: e.g. ["capture_leads","answer_faq","bookings","sales"]
  faq          jsonb,   -- {question, answer}[]
  enabled      boolean not null default true,
  generated_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_whatsapp_config_business on public.whatsapp_config(business_id);

drop trigger if exists trg_whatsapp_config_updated_at on public.whatsapp_config;
create trigger trg_whatsapp_config_updated_at
  before update on public.whatsapp_config
  for each row execute function public.set_updated_at();

alter table public.whatsapp_config enable row level security;

drop policy if exists "whatsapp_config_owner" on public.whatsapp_config;
create policy "whatsapp_config_owner" on public.whatsapp_config
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
