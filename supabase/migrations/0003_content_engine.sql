-- ============================================================================
--  Migration 0003 — Content Engine (Phase 2, Feature 1)
--  content_items — AI-generated content pieces per business.
-- ============================================================================

-- Add content to the job_type enum
do $$ begin
  alter type job_type add value if not exists 'content';
exception when others then null; end $$;

-- ============================================================================
--  content_items — individual generated content pieces
-- ============================================================================
create table if not exists public.content_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  type         text not null,   -- instagram_post | facebook_post | linkedin_post | reel_script | blog_article | email_newsletter
  title        text,
  content      text not null,
  hashtags     jsonb,           -- string[]
  cta          text,
  topic        text,
  generated_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_content_items_business on public.content_items(business_id);
create index if not exists idx_content_items_type on public.content_items(business_id, type);

drop trigger if exists trg_content_items_updated_at on public.content_items;
create trigger trg_content_items_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.content_items enable row level security;

drop policy if exists "content_items_owner" on public.content_items;
create policy "content_items_owner" on public.content_items
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
