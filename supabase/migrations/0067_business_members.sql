-- ============================================================================
--  Migration 0067 — Business members (multi-user access)
--  Team members + invites for a business, plus the shared is_business_owner()
--  helper redefined so every existing RLS policy in the app inherits team
--  access for free (owner + active members = full data access; only the real
--  owner or an 'admin' member may manage the team itself).
-- ============================================================================

-- ── business_members ────────────────────────────────────────────────────────
create table if not exists public.business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists business_members_business_idx
  on public.business_members (business_id);
create index if not exists business_members_user_idx
  on public.business_members (user_id);

-- ── business_member_invites ─────────────────────────────────────────────────
create table if not exists public.business_member_invites (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email       text not null,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  token       uuid not null default gen_random_uuid() unique,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists business_member_invites_business_idx
  on public.business_member_invites (business_id);
create index if not exists business_member_invites_token_idx
  on public.business_member_invites (token);

-- ============================================================================
--  CRITICAL: redefine the existing SECURITY DEFINER helper (see
--  0001_foundation.sql) — same name/signature — so all ~50 existing RLS
--  policies across the app automatically grant full data access to active
--  team members (both 'admin' and 'staff'), not just the real owner.
-- ============================================================================
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
  )
  or exists (
    select 1 from public.business_members m
    where m.business_id = b_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- ── Helper: is the current user the real owner or an admin team member? ──────
-- Used to gate team management (inviting/removing/role changes) — staff must
-- NOT be able to do this even though they have full data access above.
create or replace function public.is_business_owner_or_admin(b_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = b_id and b.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.business_members m
    where m.business_id = b_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.business_members enable row level security;
alter table public.business_member_invites enable row level security;

drop policy if exists "business_members_manage" on public.business_members;
create policy "business_members_manage" on public.business_members
  for all
  using (public.is_business_owner_or_admin(business_id))
  with check (public.is_business_owner_or_admin(business_id));

-- A member can always see their own membership row (e.g. to know their role),
-- even if they're staff (not covered by the manage policy above).
drop policy if exists "business_members_select_own" on public.business_members;
create policy "business_members_select_own" on public.business_members
  for select
  using (user_id = auth.uid());

drop policy if exists "business_member_invites_manage" on public.business_member_invites;
create policy "business_member_invites_manage" on public.business_member_invites
  for all
  using (public.is_business_owner_or_admin(business_id))
  with check (public.is_business_owner_or_admin(business_id));

-- businesses: active team members (not just the owner) must see the business
-- in their businesses list — extends the owner-only policy from 0001.
drop policy if exists "businesses_select_member" on public.businesses;
create policy "businesses_select_member" on public.businesses
  for select
  using (
    exists (
      select 1 from public.business_members m
      where m.business_id = businesses.id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );
