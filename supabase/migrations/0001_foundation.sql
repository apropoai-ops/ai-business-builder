-- ============================================================================
--  Migration 0001 — Foundation
--  Extensions, shared enums, profiles, businesses, RLS framework, triggers.
--  Part of milestone M0.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector (used by RAG in M6)

-- ── Shared enums ────────────────────────────────────────────────────────────
do $$ begin
  create type plan_tier as enum ('free', 'starter', 'pro', 'business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type business_status as enum ('draft', 'generating', 'ready', 'archived');
exception when duplicate_object then null; end $$;

-- ── Utility: updated_at trigger ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
--  profiles — extends auth.users 1:1
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  plan        plan_tier not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  businesses — TENANT ROOT. Every feature table references this.
-- ============================================================================
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text,
  type            text,
  industry        text,
  location        text,
  target_audience text,
  budget          numeric,
  revenue_goal    numeric,
  description     text not null,
  status          business_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_businesses_owner on public.businesses(owner_id);

drop trigger if exists trg_businesses_updated_at on public.businesses;
create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.profiles   enable row level security;
alter table public.businesses enable row level security;

-- profiles: a user can read & update only their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- businesses: owner has full access to their own businesses.
drop policy if exists "businesses_all_own" on public.businesses;
create policy "businesses_all_own" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── Reusable helper: is the current user the owner of a business? ────────────
-- Used by every feature table's RLS policy in later migrations.
create or replace function public.is_business_owner(b_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = b_id and b.owner_id = auth.uid()
  );
$$;
