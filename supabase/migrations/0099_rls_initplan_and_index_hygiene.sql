-- 0099 — RLS init-plan fixes, FK indexes, and function hardening.
--
-- Three unrelated classes of DB defect, all surfaced by the Supabase advisors:
--
-- 1. auth_rls_initplan (17 policies). A bare `auth.uid()` inside a policy is
--    volatile from the planner's point of view, so Postgres re-evaluates it
--    once PER ROW scanned. Wrapping it as `(select auth.uid())` turns it into
--    a one-off InitPlan evaluated once per statement. Identical semantics,
--    same rows in and out — this is purely how often the function runs. It
--    matters most on `orders` / `order_items` / `bookings`, which also carry a
--    second permissive policy (the owner one), so every row was paying for
--    both. Uses ALTER POLICY rather than DROP+CREATE so the table is never
--    momentarily unprotected.
--
-- 2. Index hygiene: 13 foreign keys had no covering index (every cascade and
--    every join through them was a seq scan), and blog_posts carried two
--    byte-identical indexes.
--
-- 3. Function hardening: set_updated_at had a role-mutable search_path, and
--    handle_new_user — a trigger function, never meant to be an endpoint — was
--    reachable as `/rest/v1/rpc/handle_new_user` by anon.

-- ── 1. RLS: hoist auth.uid() into an InitPlan ───────────────────────────────

alter policy "profiles_select_own" on public.profiles
  using (id = (select auth.uid()));
alter policy "profiles_update_own" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "businesses_all_own" on public.businesses
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
alter policy "businesses_select_member" on public.businesses
  using (exists (
    select 1 from public.business_members m
    where m.business_id = businesses.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

alter policy "business_members_select_own" on public.business_members
  using (user_id = (select auth.uid()));

alter policy "customer_profiles_self" on public.customer_profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
alter policy "customer_addresses_self" on public.customer_addresses
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "customer_payment_methods_self" on public.customer_payment_methods
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "orders_customer_select" on public.orders
  using (customer_user_id = (select auth.uid()));
alter policy "order_items_customer_select" on public.order_items
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.customer_user_id = (select auth.uid())
  ));
alter policy "order_invoices_customer_select" on public.order_invoices
  using (exists (
    select 1 from public.orders o
    where o.id = order_invoices.order_id and o.customer_user_id = (select auth.uid())
  ));
alter policy "order_refunds_customer_select" on public.order_refunds
  using (exists (
    select 1 from public.orders o
    where o.id = order_refunds.order_id and o.customer_user_id = (select auth.uid())
  ));

alter policy "bookings_customer_select" on public.bookings
  using (customer_user_id = (select auth.uid()));
alter policy "rental_bookings_customer_select" on public.rental_bookings
  using (customer_user_id = (select auth.uid()));
alter policy "loyalty_points_self" on public.loyalty_points
  using (customer_user_id = (select auth.uid()));
alter policy "referrals_referrer_select" on public.referrals
  using (referrer_user_id = (select auth.uid()));
alter policy "push_subscriptions_own_all" on public.push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 2. Index hygiene ────────────────────────────────────────────────────────

-- Byte-identical to idx_blog_posts_business (same columns, same order, same
-- DESC) — pure write overhead.
drop index if exists public.blog_posts_business_published_idx;

create index if not exists idx_automation_runs_automation
  on public.automation_runs (automation_id);
create index if not exists idx_booking_staff_services_service
  on public.booking_staff_services (service_id);
create index if not exists idx_booking_waitlist_service
  on public.booking_waitlist (service_id);
create index if not exists idx_booking_waitlist_staff
  on public.booking_waitlist (staff_id);
create index if not exists idx_bookings_service
  on public.bookings (service_id);
create index if not exists idx_bookings_staff
  on public.bookings (staff_id);
create index if not exists idx_crm_activities_customer
  on public.crm_activities (customer_id);
create index if not exists idx_crm_activities_lead
  on public.crm_activities (lead_id);
create index if not exists idx_crm_tasks_customer
  on public.crm_tasks (customer_id);
create index if not exists idx_crm_tasks_lead
  on public.crm_tasks (lead_id);
create index if not exists idx_platform_charges_user
  on public.platform_charges (user_id);
create index if not exists idx_rental_bookings_crm_customer
  on public.rental_bookings (crm_customer_id);
create index if not exists idx_whatsapp_messages_business
  on public.whatsapp_messages (business_id);

-- ── 3. Function hardening ───────────────────────────────────────────────────

-- Pin the search_path so the function can't resolve `now()` through a
-- caller-controlled schema. It only touches pg_catalog.
alter function public.set_updated_at() set search_path = pg_catalog;

-- handle_new_user is the auth.users AFTER INSERT trigger, never an endpoint.
-- Revoke from PUBLIC, not from anon/authenticated: Postgres grants EXECUTE to
-- PUBLIC on every new function, and neither role held a direct grant — they
-- inherited it, so revoking them by name is a silent no-op. postgres and
-- service_role keep their explicit grants. Triggers are fired by the executor
-- and do not consult the invoking role's EXECUTE privilege, so signup is
-- unaffected (verified: inserting an auth.users row still creates its
-- public.profiles row after this revoke).
--
-- NOTE: deliberately NOT doing this for is_business_owner /
-- is_business_owner_or_admin — those are referenced from RLS policy
-- expressions, which ARE evaluated with the querying role's privileges, so
-- revoking EXECUTE there would break every owner policy.
revoke execute on function public.handle_new_user() from public;
