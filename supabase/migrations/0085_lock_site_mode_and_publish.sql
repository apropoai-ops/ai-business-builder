-- 0085 — close the last two self-service revenue holes: businesses.site_mode
-- and websites.published. Completes what 0083 started on profiles.plan.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.
--
-- SHIPS WITH A CODE CHANGE. Do not apply this alone — see §3 below.
--
-- ── The holes ───────────────────────────────────────────────────────────────
-- pg_class.relacl for public.businesses and public.websites is
--   {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=…}
-- a TABLE-level grant carrying `w`, and both governing policies are FOR ALL
-- (pg_policy.polcmd '*'): businesses_all_own (0001:114) and websites_owner.
-- So with the publicly-shipped anon key plus any logged-in session:
--
--   (a) PATCH /rest/v1/businesses?id=eq.<own biz>  {"site_mode":"store"}
--       is a free ₪349 → ₪699 upgrade, bypassing planAllowsSiteMode.
--   (b) PATCH /rest/v1/websites?business_id=eq.<own biz>  {"published":true}
--       puts a site the customer never paid for live, bypassing the paywall at
--       lib/actions/website.ts:65-79 — whose own comment calls itself "the one
--       place a mode the customer hasn't paid for is stopped from going live".
--
-- (b) also has a DELETE-then-INSERT variant: business_id is the only NOT NULL
-- column without a default, so the row can simply be re-created with
-- published=true. Both paths are closed below.
--
-- ── Why a trigger and not a column re-grant ─────────────────────────────────
-- 0083 could re-grant columns because profiles is 7 stable columns. businesses
-- has ~40 and gains more every few migrations, and 0072 exists precisely so
-- team members can write most of them — an explicit column list would silently
-- un-write the next column added. Same for websites. Targeted trigger instead.
--
-- The role test is an ALLOWLIST, not a denylist of ('anon','authenticated'):
-- it fails CLOSED if PostgREST ever runs as a role we did not enumerate.
-- Verified on this database with pg_has_role(rolname,'service_role','member'):
--   anon → false, authenticated → false, supabase_auth_admin → false
--   service_role / postgres / authenticator / supabase_admin → true
-- so migrations (postgres), every createServiceRoleClient() call and every
-- postgres-owned SECURITY DEFINER admin_* function pass; PostgREST under a user
-- JWT (SET LOCAL ROLE authenticated) does not.
--
-- KNOWN LOOPHOLE, documented deliberately: any postgres-owned SECURITY DEFINER
-- function granted to `authenticated` runs with current_user = postgres and is
-- therefore trusted by this guard. Today the only such function that writes
-- businesses is public.next_invoice_number, and it does not touch site_mode.
-- STANDING RULE: no new SECURITY DEFINER function granted to `authenticated`
-- may write businesses.site_mode or websites.published.
-- ────────────────────────────────────────────────────────────────────────────


-- ══ 1. The guard ═══════════════════════════════════════════════════════════

create or replace function public.assert_platform_controlled_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if pg_has_role(current_user, 'service_role', 'member') then
    return new;                       -- trusted server code / migrations
  end if;

  if tg_table_name = 'businesses' then
    if tg_op = 'UPDATE' and new.site_mode is distinct from old.site_mode then
      raise exception
        'site_mode is set by the package or the operator, not by the client'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'websites' then
    if tg_op = 'INSERT' and coalesce(new.published, false) then
      raise exception
        'publish state is set by the platform, not by the client'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE'
       and coalesce(new.published, false) is distinct from coalesce(old.published, false) then
      raise exception
        'publish state is set by the platform, not by the client'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_site_mode on public.businesses;
create trigger trg_guard_site_mode
  before update on public.businesses
  for each row execute function public.assert_platform_controlled_write();

drop trigger if exists trg_guard_publish on public.websites;
create trigger trg_guard_publish
  before insert or update on public.websites
  for each row execute function public.assert_platform_controlled_write();

-- Closes the DELETE-then-INSERT bypass. Verified: NO application code path
-- deletes a websites row (grep of lib/, app/, scripts/ for from("websites")
-- with .delete() returns nothing). Cascade deletes from businesses are
-- performed by the referential-integrity system, which does not consult the
-- invoking role's DELETE privilege.
revoke delete on public.websites from anon, authenticated;

-- businesses INSERT is deliberately NOT guarded: the wizard
-- (lib/actions/business.ts:107, RLS client) legitimately inserts a
-- plan-validated site_mode, and a raw PostgREST INSERT of site_mode='store' is
-- now defused anyway — the storefront cannot be published (the websites guard
-- covers INSERT *and* UPDATE, DELETE is revoked) and /s/[slug] resolves only
-- published rows (getPublicSiteBasicsBySlug, lib/services/website.service.ts).
-- websites.published defaults to false and is NOT NULL, so an ordinary INSERT
-- of a fresh row — and PostgREST's upsert, which fires BEFORE INSERT with the
-- default before taking the ON CONFLICT DO UPDATE branch — passes untouched.


-- ══ 2. Leftover EXECUTE grant (unrelated to §1, same blind spot) ════════════
-- is_business_owner_or_admin carries `=X/postgres` (PUBLIC) + anon=X while its
-- sibling is_business_owner is {postgres,authenticated,service_role} — a
-- remnant 0076 missed. It is SECURITY DEFINER and owned by postgres, so a
-- direct anon-key RPC call evaluates business membership with the definer's
-- rights. Its only two consumers are the FOR ALL policies on business_members
-- and business_member_invites, and every application read/write of those two
-- tables goes through createServiceRoleClient() (lib/services/members.service.ts),
-- which bypasses RLS entirely — so nothing in the app evaluates it as anon.
revoke all on function public.is_business_owner_or_admin(uuid) from public, anon;


-- ══ 3. CODE CHANGES THIS FORCES — both shipped with this migration ══════════
--   1. lib/services/website.service.ts setWebsitePublishState moved from
--      createClient() to createServiceRoleClient(). Without it, publishing
--      breaks for every existing customer. Ownership is now asserted inside
--      that function on the RLS client before the service-role write (it was
--      previously implicit in RLS), and the 23505 → "הכתובת הזו כבר תפוסה"
--      translation is unchanged.
--   2. lib/actions/site-mode.ts emptied to a tombstone. setSiteModeAction had
--      ZERO call sites (grep-verified) and wrote site_mode on the RLS client,
--      so it would now throw; leaving it beside the operator console's
--      admin_set_site_mode means two divergent definitions of "change the mode".


-- ── Down ────────────────────────────────────────────────────────────────────
--   drop trigger if exists trg_guard_publish   on public.websites;
--   drop trigger if exists trg_guard_site_mode on public.businesses;
--   drop function if exists public.assert_platform_controlled_write();
--   grant delete on public.websites to anon, authenticated;
--   grant execute on function public.is_business_owner_or_admin(uuid) to public;
--
-- REVERT THE CODE FIRST, in the same deploy: setWebsitePublishState must go
-- back to createClient() before the triggers are dropped, or a service-role
-- write survives with no RLS behind it.
