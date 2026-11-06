-- ============================================================================
--  Migration 0006 — Social Media Assistant (Phase 2, Feature 3)
--  social_profiles — per-platform presence strategy per business.
-- ============================================================================

do $$ begin
  alter type job_type add value if not exists 'social_media';
exception when others then null; end $$;

create table if not exists public.social_profiles (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  platform           text not null,   -- instagram | facebook | linkedin | tiktok
  bio                text,
  content_pillars    jsonb,           -- string[]
  posting_frequency  text,
  best_times         jsonb,           -- string[]
  hashtag_sets       jsonb,           -- string[][] or string[]
  sample_posts       jsonb,           -- {title, body}[]
  growth_tips        jsonb,           -- string[]
  generated_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (business_id, platform)
);

create index if not exists idx_social_profiles_business on public.social_profiles(business_id);

drop trigger if exists trg_social_profiles_updated_at on public.social_profiles;
create trigger trg_social_profiles_updated_at
  before update on public.social_profiles
  for each row execute function public.set_updated_at();

alter table public.social_profiles enable row level security;

drop policy if exists "social_profiles_owner" on public.social_profiles;
create policy "social_profiles_owner" on public.social_profiles
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
