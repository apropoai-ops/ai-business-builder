-- ============================================================================
--  Migration 0022 — Advertising (Phase 3)
--  ad_campaigns — per-platform AI-generated ad strategy (campaign structure,
--  audiences, ad copy variants, creative concepts) per business.
-- ============================================================================

do $$ begin
  alter type job_type add value if not exists 'ads';
exception when others then null; end $$;

create table if not exists public.ad_campaigns (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  platform      text not null,   -- meta | google | tiktok
  objective     text,
  campaign      jsonb,           -- { name, objective, budgetSuggestion, bidStrategy }
  audiences     jsonb,           -- { name, description, targeting }[]
  ad_copies     jsonb,           -- { headline, body, cta }[]
  creatives     jsonb,           -- { concept, format, visualIdea }[]
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, platform)
);

create index if not exists idx_ad_campaigns_business on public.ad_campaigns(business_id);

drop trigger if exists trg_ad_campaigns_updated_at on public.ad_campaigns;
create trigger trg_ad_campaigns_updated_at
  before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

alter table public.ad_campaigns enable row level security;

drop policy if exists "ad_campaigns_owner" on public.ad_campaigns;
create policy "ad_campaigns_owner" on public.ad_campaigns
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
