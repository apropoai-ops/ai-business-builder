-- ============================================================================
--  Migration 0004 — Features 2-6 tables (were coded but never migrated)
--  market_research, brand_assets, websites, crm_*, ceo_messages.
-- ============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────
do $$ begin
  create type lead_status as enum ('new', 'contacted', 'qualified', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_stage as enum ('lead', 'proposal', 'negotiation', 'won', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

-- ============================================================================
--  market_research (F2)
-- ============================================================================
create table if not exists public.market_research (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references public.businesses(id) on delete cascade,
  competitors   jsonb,
  swot          jsonb,
  opportunities jsonb,
  positioning   text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_market_research_business on public.market_research(business_id);
drop trigger if exists trg_market_research_updated_at on public.market_research;
create trigger trg_market_research_updated_at before update on public.market_research
  for each row execute function public.set_updated_at();

-- ============================================================================
--  brand_assets (F3)
-- ============================================================================
create table if not exists public.brand_assets (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references public.businesses(id) on delete cascade,
  brand_name    text,
  slogan        text,
  mission       text,
  vision        text,
  personality   jsonb,
  color_palette jsonb,
  typography    jsonb,
  logo_prompt   text,
  brand_voice   text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_brand_assets_business on public.brand_assets(business_id);
drop trigger if exists trg_brand_assets_updated_at on public.brand_assets;
create trigger trg_brand_assets_updated_at before update on public.brand_assets
  for each row execute function public.set_updated_at();

-- ============================================================================
--  websites (F4)
-- ============================================================================
create table if not exists public.websites (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references public.businesses(id) on delete cascade,
  page_home     jsonb,
  page_about    jsonb,
  page_services jsonb,
  page_contact  jsonb,
  page_faq      jsonb,
  seo_meta      jsonb,
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_websites_business on public.websites(business_id);
drop trigger if exists trg_websites_updated_at on public.websites;
create trigger trg_websites_updated_at before update on public.websites
  for each row execute function public.set_updated_at();

-- ============================================================================
--  CRM (F5)
-- ============================================================================
create table if not exists public.crm_leads (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  status      lead_status not null default 'new',
  source      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_crm_leads_business on public.crm_leads(business_id);
drop trigger if exists trg_crm_leads_updated_at on public.crm_leads;
create trigger trg_crm_leads_updated_at before update on public.crm_leads
  for each row execute function public.set_updated_at();

create table if not exists public.crm_customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_crm_customers_business on public.crm_customers(business_id);
drop trigger if exists trg_crm_customers_updated_at on public.crm_customers;
create trigger trg_crm_customers_updated_at before update on public.crm_customers
  for each row execute function public.set_updated_at();

create table if not exists public.crm_tasks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title       text not null,
  description text,
  priority    task_priority not null default 'medium',
  done        boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_crm_tasks_business on public.crm_tasks(business_id);
drop trigger if exists trg_crm_tasks_updated_at on public.crm_tasks;
create trigger trg_crm_tasks_updated_at before update on public.crm_tasks
  for each row execute function public.set_updated_at();

create table if not exists public.crm_deals (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  title        text not null,
  value        numeric,
  stage        deal_stage not null default 'lead',
  contact_name text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_crm_deals_business on public.crm_deals(business_id);
drop trigger if exists trg_crm_deals_updated_at on public.crm_deals;
create trigger trg_crm_deals_updated_at before update on public.crm_deals
  for each row execute function public.set_updated_at();

-- ============================================================================
--  ceo_messages (F6)
-- ============================================================================
create table if not exists public.ceo_messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ceo_messages_business on public.ceo_messages(business_id, created_at);

-- ============================================================================
--  Row Level Security — owner policy on every table
-- ============================================================================
alter table public.market_research enable row level security;
alter table public.brand_assets    enable row level security;
alter table public.websites        enable row level security;
alter table public.crm_leads       enable row level security;
alter table public.crm_customers   enable row level security;
alter table public.crm_tasks       enable row level security;
alter table public.crm_deals       enable row level security;
alter table public.ceo_messages    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'market_research','brand_assets','websites',
    'crm_leads','crm_customers','crm_tasks','crm_deals','ceo_messages'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id))',
      t || '_owner', t
    );
  end loop;
end $$;
