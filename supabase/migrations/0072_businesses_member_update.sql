-- ============================================================================
--  Migration 0072 — businesses: allow active team members to UPDATE
--  Migration 0067 redefined is_business_owner() to include active team
--  members and added businesses_select_member (SELECT only), but never
--  touched businesses_all_own (0001_foundation.sql), which is still the only
--  write policy on public.businesses and checks the literal owner_id. As a
--  result, admin/staff writes to businesses (design_tier, module_config,
--  payment_link, shipping_fee, popup_*, referral_*, loyalty_*, size_guide,
--  announcement_bar, email_from_name/email_reply_to, etc.) silently match
--  zero rows under RLS and appear to succeed while persisting nothing.
--
--  This adds a sibling permissive UPDATE policy for active team members,
--  matching the pattern already used by ~50 other feature-table policies
--  since 0067. Postgres OR's permissive policies for the same command, so
--  this only adds access on top of businesses_all_own.
--
--  INSERT and DELETE intentionally remain owner-only (businesses_all_own):
--  the members UI explicitly documents that admins get "גישה מלאה לכל
--  הנתונים, חוץ מ... מחיקת העסק" (full data access, except deleting the
--  business) — deleting/creating a business is not part of member access.
-- ============================================================================

drop policy if exists "businesses_update_member" on public.businesses;
create policy "businesses_update_member" on public.businesses
  for update
  using (public.is_business_owner(id))
  with check (public.is_business_owner(id));
