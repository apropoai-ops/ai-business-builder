-- ============================================================================
--  Migration 0042 — Wave E (part 2): referral program (חבר מביא חבר).
--  Each shopper gets a global referral_code. When a referred shopper places
--  their first order at a store (referral enabled), the referrer earns loyalty
--  points. referrals records each successful referral (dedupe + the referrer's
--  view). Applied via MCP.
-- ============================================================================

alter table public.customer_profiles
  add column if not exists referral_code text;
create unique index if not exists uq_customer_profiles_referral_code
  on public.customer_profiles (referral_code)
  where referral_code is not null;

alter table public.businesses
  add column if not exists referral_enabled boolean not null default false,
  add column if not exists referral_points int not null default 50;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referred_phone text,
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_referrals_business on public.referrals (business_id, created_at);
create index if not exists idx_referrals_referrer on public.referrals (referrer_user_id);
-- Don't reward the same referred shopper twice per business.
create unique index if not exists uq_referrals_biz_referred_user
  on public.referrals (business_id, referred_user_id)
  where referred_user_id is not null;
alter table public.referrals enable row level security;
drop policy if exists "referrals_owner" on public.referrals;
create policy "referrals_owner" on public.referrals
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
drop policy if exists "referrals_referrer_select" on public.referrals;
create policy "referrals_referrer_select" on public.referrals
  for select using (referrer_user_id = auth.uid());
