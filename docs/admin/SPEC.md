# IMPLEMENTATION SPEC — מוקד (Moked): platform operator console at `/admin`

Target repo: `C:/Users/ofek8/OneDrive/Desktop/הכל לעסקים` (Next.js 16.2.12 App Router, React 19.2.4, Supabase, Tailwind v4, Hebrew RTL, TypeScript). No git. Migrations applied via Supabase MCP against project `vxkamrcukzdovfikzeyt`.

---

## 1. What this is and what it deliberately is not

**Is:** a triage-first operator console for the single platform operator. `/admin` opens on a severity-ordered list of *what is broken right now* across every tenant, each fault carrying the Hebrew string the customer is quoting at you plus a one-click remediation. Quota and package upgrades are implemented as **additive, revocable, superseding grant rows** that the Stripe webhook cannot silently revert. Every mutation is atomic with an append-only audit row. It also closes three live self-service revenue holes in the same migration, because without them the console's headline actions write columns the customer can already write.

**Is not:**

| Not | Why |
|---|---|
| A cross-tenant RLS widening | We do **not** redefine `is_business_owner()` to include operators (the cheap 84-of-102-policy lever at `supabase/migrations/0067_business_members.sql:48`). Most of those policies are `FOR ALL`; it would hand the operator INSERT/UPDATE/DELETE on ~88 tables with no per-action gate, and it would widen `listBusinesses()` (`lib/services/business.service.ts:14-22`, deliberately unfiltered) into the operator's own BusinessSwitcher. |
| A downgrade tool | `admin_set_site_mode` raises on any rank-decreasing change, matching the one-directional rule at `lib/services/billing.service.ts:169-183`. Losing features ≠ losing your live site. |
| A site regenerator | `generateWebsite` takes no `site_mode` input (`lib/jobs/handlers/website.ts:82` branches only for `landing`), and re-running overwrites `page_home/about/services/contact/faq`. The upgrade never regenerates; `landing → store` is refused outright. |
| A product seeder | `scripts/seed-mode-demos.ts` DELETEs all products before inserting. Never on a live customer. The action returns a checklist and the board carries `חנות ללא מוצרים` as a standing fault. |
| An observability platform | No `platform_incidents`, no `sms_log`, no persisted client errors, no `whatsapp_messages.status`, no `agent_logs.cost_usd` backfill. Each is a hot-path write on a route that currently must not throw. V1 reads what exists and **prints its own blind spots on the screen**. |
| A design-tier lever | `resolveDesignTier` ignores its arguments and always returns `'professional'` (`lib/design-tier.ts:39-45`). Dead data. |
| A raw-SQL / row-editor surface | The console's entire capability set is enumerable by reading `lib/actions/admin.ts`. There is no DELETE verb anywhere. |

---

## 2. The auth boundary

### 2.1 Identity — new table, no existing mechanism reused

**new** `public.platform_admins` — RLS enabled, **zero policies**, all privileges revoked from `anon`, `authenticated` *and* `service_role` (SELECT only for `service_role`). This copies the `rate_limits` precedent (`supabase/migrations/0010_rate_limits_daily_briefs.sql:6-11`, "no policies: service-role only"). Seeded in-migration with the founder uuid already hardcoded at `lib/quota.ts:33`.

Rejected identity carriers, each verified:
- `profiles.is_platform_admin` column — `pg_class.relacl` for `public.profiles` is a **table-level** grant `authenticated=arwdDxtm`, and `profiles_update_own` (`supabase/migrations/0001_foundation.sql:109-111`) has no column restriction. One PATCH self-promotes.
- `user_metadata` — user-writable; proven in this repo at `lib/auth/actions.ts:299` and `app/auth/callback/route.ts:26`.
- a `business_members` row — `0067:48` makes one active row unlock 82 live policies, and it is visible to the customer in their own team screen.
- `UNLIMITED_BUSINESS_USER_IDS` (`lib/quota.ts:31-37`) — Postgres cannot read a Vercel env var; revocation needs a redeploy; no FK for the audit log.
- `app_metadata` — sound, but the claim freezes in the access token until refresh (~1h revocation lag) and cannot be joined in SQL.

### 2.2 Predicates — two SECURITY DEFINER read-only functions

- `public.is_platform_admin() → boolean` — used inside every mutation RPC.
- **new** `public.platform_admin_self() → jsonb` — returns `{"is_admin":bool,"require_mfa":bool,"label":text}`; used by `requireOperator()` because the RLS client cannot read `platform_admins` directly.

Both: `security definer`, `stable`, `set search_path = public`, then `revoke all ... from public, anon; grant execute ... to authenticated;`. **The revoke-from-PUBLIC is not optional** — it is verbatim the bug `supabase/migrations/0076_lock_down_service_role_rpcs.sql:1-3` exists to fix, and `is_business_owner_or_admin(uuid)` still carries PUBLIC EXECUTE today (live ACL begins `=X/postgres`) because 0067 never revoked it.

### 2.3 Mutation RPCs derive the actor from the JWT — they do not accept one

Every `admin_*` mutation RPC is `SECURITY DEFINER` (owner `postgres`), takes **no `p_actor` parameter**, and opens with:

```sql
v_actor := auth.uid();
if not public.is_platform_admin() then
  raise exception 'not a platform operator' using errcode = '42501';
end if;
```

ACL: `revoke all on function ... from public, anon, service_role; grant execute ... to authenticated;`

This is the single most important correction to the original design. A `p_actor uuid` parameter is caller-supplied, so anyone holding `SUPABASE_SERVICE_ROLE_KEY` could `POST /rest/v1/rpc/admin_grant` with the founder uuid (cleartext at `lib/quota.ts:33` and `scripts/seed-mode-demos.ts:30`) and author audit rows naming the founder. `auth.uid()` reads `request.jwt.claims`, which PostgREST populates only from a signature-verified token — unforgeable. Revoking `service_role` means a leaked service key cannot invoke these functions at all.

This is **not** the 0076 anti-pattern. 0076's functions were definer functions that trusted whoever called them. These derive identity from `auth.uid()` and re-check membership on every call. Definer also solves a second problem: `service_role` does **not** hold SELECT on `auth.users` (`has_table_privilege('service_role','auth.users','select')` = false — `rolbypassrls` bypasses RLS, not GRANTs), so an INVOKER function reading `auth.users` for the audit snapshot would fail at runtime while creating cleanly during migration (which runs as `postgres`).

**Corollary for TypeScript:** never query `auth.users` from the service-role client. Use `supabase.auth.admin.getUserById` / `listUsers` (the Admin REST API), as the repo already does at `lib/services/members.service.ts:85`.

### 2.4 Enforcement points — all four

1. **`proxy.ts` / `lib/supabase/middleware.ts:55`** — add `pathname.startsWith("/admin")` to `isProtected`. **Optimistic pre-filter only**; the bundled docs say the proxy "should not be used as a full session management or authorization solution" (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:29`).
2. **`app/(admin)/layout.tsx`** — `await requireOperator()`. Protects page rendering only.
3. **Every server action** — via the `withOperator()` higher-order wrapper (§2.5). A layout guard does not protect Server Actions; each is an independently addressable POST endpoint (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1119`).
4. **Inside every mutation RPC**, in the same transaction as the write.

### 2.5 `withOperator` — the check is structurally impossible to omit

`lib/actions/admin.ts` **must not export a raw function.** Every export is a wrapper product:

```ts
// lib/auth/platform-admin.ts
export type Operator = { id: string; label: string };

export function withOperator<A extends unknown[], R>(
  fn: (op: Operator, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => fn(await requireOperator(), ...args);
}
```

The verified operator id is the only way to obtain the first parameter. A test asserts every exported member of `lib/actions/admin.ts` is a wrapper product.

### 2.6 `requireOperator()`

```ts
// lib/auth/platform-admin.ts
export async function requireOperator(): Promise<Operator> {
  const { user } = await requireUser();            // lib/auth/user.ts:22
  const supabase = await createClient();           // RLS client — NOT service role
  const { data, error } = await supabase.rpc("platform_admin_self");
  if (error || !data || data.is_admin !== true) notFound();
  if (data.require_mfa === true) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") notFound();
  }
  return { id: user.id, label: data.label ?? "operator" };
}
```

- **RLS client, not service role**: a missing, empty or rolled-back `platform_admins` table fails **CLOSED**.
- **`notFound()`, never `redirect()`**: a redirect confirms `/admin` exists to a probing visitor.
- `@supabase/supabase-js ^2.108.0` already ships `auth.mfa` — no new dependency.

### 2.7 MFA

`platform_admins.require_mfa boolean not null default false`. Live check: `select count(*) from auth.mfa_factors` = **0**, so seeding `true` would make the console unopenable and force a bootstrap `/admin/enroll` route reachable at aal1 — extra surface to work around a self-imposed lock.

**Resolution:** enroll TOTP on the founder account **out of band** (Supabase `mfa.enroll` / `mfa.challenge` from a one-off `npx tsx` script, or the account UI), then flip the row with one UPDATE. Build order step 5 does this **before** any mutation verb ships, so the console never exists in a single-factor state with write capability.

**Declined (medium, security lens):** per-mutation step-up via `supabase.auth.reauthenticate()`. It sends a nonce **by email**, and all 9 live `email_log` rows are `status='failed'` because the Resend domain is unverified — a step-up gate would brick the console. Revisit when Resend domain verification lands (it is already an open GO-LIVE item).

### 2.8 Break-glass and failure modes

| Situation | Result |
|---|---|
| Revoke an operator | `update platform_admins set disabled_at = now()` from the Supabase dashboard. No deploy — which matters with no git. Every RPC re-checks in-transaction, so in-flight actions stop too. |
| `platform_admins` empty / table missing | `platform_admin_self` returns `is_admin:false` or errors → `notFound()`. Console unreachable. **Fails closed.** |
| `SUPABASE_SERVICE_ROLE_KEY` leaked | Console reads are possible (they are service-role), but no `admin_*` RPC can be invoked (`service_role` has no EXECUTE), no grant can be created, and `admin_audit_log` cannot be written, updated, deleted or truncated (`service_role` holds SELECT only). |
| Operator cookie stolen | Attacker gets everything the console does. Mitigations: TOTP (step 5), no DELETE verb, 20-grants-per-24h SQL ceiling, every action audited with a mandatory reason. |
| Anonymous visitor hits `/admin` | Proxy redirects to `/login` (after the one-line change); without it, the layout `notFound()`s. |

**The honest boundary:** all console *reads* use `createServiceRoleClient()` (`lib/supabase/server.ts:43`, `rolbypassrls` verified), so `requireOperator()` is the read boundary and there is no database backstop for reads. Mitigations: a single choke-point module (`lib/services/admin/client.ts`) that is the only sanctioned place to construct a service-role client in console code; read-only-by-default screens; counts and health flags rather than `select('*')` on PII tables.

---

## 3. Migration

One file: `supabase/migrations/0083_platform_operator_console.sql`. Last existing is `0082_whatsapp_follow_up.sql`. Apply via MCP `apply_migration`, as the 0002 / 0014 / 0015 / 0037 headers document.

**Reversibility, stated explicitly:**

| Part | Reversible? |
|---|---|
| §2–§6 (tables, functions, indexes) | Yes — the down-path drops them. **The application code must be reverted FIRST**: after §7 lands, `getPlanForUser` reads `platform_grants` and throws if the table is gone, which would break all AI for every customer. |
| §1a `revoke update on public.profiles` | Yes — `grant update on public.profiles to anon, authenticated;` restores it exactly. |
| §1b/§1c triggers + `revoke delete on websites` | Yes — drop the triggers, re-grant DELETE, and revert `setWebsitePublishState` to `createClient()` in the same deploy. |
| `admin_audit_log` rows | **No.** Append-only by trigger. This is the point. |

### 3.1 Complete SQL

```sql
-- supabase/migrations/0083_platform_operator_console.sql
-- Applied via MCP. NO GIT IN THIS REPO — the down-path at the bottom is the
-- only revert that exists. Keep it with the file.
--
-- ============================================================================
--  0083 — Platform operator console (מוקד)
--
--  Section 1 is a REVENUE-SECURITY FIX and is the riskiest part of this file.
--  Sections 2-6 are the console itself and are purely additive.
--
--  Three verified holes are closed in section 1. pg_class.relacl for
--  public.profiles, public.businesses AND public.websites is
--  {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm,
--  service_role=arwdDxtm} — a TABLE-level grant carrying `w`.
--
--    (a) profiles.plan       profiles_update_own (0001:109) is FOR UPDATE with
--                            no column restriction:
--                              PATCH /rest/v1/profiles?id=eq.<own uid>
--                                {"plan":"business"}
--                            with the publicly-shipped anon key is a free ₪699
--                            tier. getPlanForUser (lib/quota.ts:87-100) reads
--                            exactly this column for every quota and
--                            entitlement decision.
--    (b) businesses.site_mode businesses_all_own (0001:114) is FOR ALL:
--                            {"site_mode":"store"} is a free ₪349→₪699 upgrade,
--                            bypassing planAllowsSiteMode
--                            (lib/actions/site-mode.ts:42).
--    (c) websites.published  websites_owner is a single FOR ALL policy over
--                            is_business_owner(business_id) (pg_policy: polcmd
--                            '*'), and setWebsitePublishState
--                            (lib/services/website.service.ts:37-52) writes
--                            through the RLS client. Both the UPDATE path AND
--                            the DELETE-then-INSERT path must be closed:
--                            business_id is the only NOT NULL column without a
--                            default, so a client can re-INSERT the row with
--                            published=true. The paywall bypassed is
--                            lib/actions/website.ts:65-79, whose own comment
--                            calls it "the one place a mode the customer hasn't
--                            paid for is stopped from going live".
--
--  Without (a) the console is theatre: its headline action writes a column the
--  customer can already write, and the audit trail cannot tell a granted
--  upgrade from a stolen one. Without (c) there is no revenue model.
--
--  DESIGN RULE below: every admin_* mutation function is SECURITY DEFINER,
--  derives its actor from auth.uid(), re-checks platform_admins in its own
--  body, and is revoked from public, anon AND service_role. That is the SAFE
--  shape of the construct 0076 locked down — 0076's functions trusted whoever
--  called them; these trust nobody and identify the caller from a
--  signature-verified JWT.
-- ============================================================================


-- ══ 1. PREREQUISITE: close the three self-service holes ════════════════════

-- 1a. profiles.plan
-- A column-level `revoke update (plan)` here would be a SILENT NO-OP: you
-- cannot revoke a column subset out of a table-level grant. The table grant
-- goes first, then the writable columns come back. profiles is 7 stable
-- columns; new columns then default to not-client-writable, which is the
-- direction we want.
revoke update on public.profiles from anon, authenticated;
grant  update (id, full_name, avatar_url, phone) on public.profiles to authenticated;
-- `id` IS REQUIRED. lib/auth/actions.ts:269-271 does
--   .upsert({ id: user.id, full_name: fullName }, { onConflict: "id" })
-- and PostgREST derives the ON CONFLICT DO UPDATE SET list from the payload
-- keys, so `id` lands in the SET list and needs the privilege. Harmless:
-- profiles_update_own's WITH CHECK (id = auth.uid()) makes writing it a no-op.
-- `plan` and `created_at` are intentionally absent → service_role / definer
-- only, which matches reality: profiles.plan's sole writer is
-- syncSubscriptionFromStripe (lib/services/billing.service.ts:158).

-- 1b + 1c. site_mode and published.
-- businesses has ~40 columns and gains more every few migrations, and 0072
-- exists precisely so team members can write most of them — a column re-grant
-- list would silently un-write the next column added. Same for websites. Both
-- get a targeted trigger instead.
--
-- The role test is an ALLOWLIST, not a denylist of ('anon','authenticated'):
-- it fails CLOSED if PostgREST ever runs as a role we did not enumerate.
-- Verified with pg_has_role(rolname,'service_role','member'):
--   authenticated → false, anon → false
--   service_role/postgres/authenticator/supabase_admin → true
-- so migrations (postgres), every createServiceRoleClient() call, and every
-- postgres-owned SECURITY DEFINER admin_* function pass; PostgREST under a user
-- JWT (SET LOCAL ROLE authenticated) does not.
--
-- KNOWN LOOPHOLE, documented deliberately: any postgres-owned SECURITY DEFINER
-- function granted to `authenticated` runs with current_user = postgres and is
-- therefore trusted by this guard. Today the only such function that writes
-- businesses is public.next_invoice_number, and it does not touch site_mode.
-- STANDING RULE: no new SECURITY DEFINER function granted to `authenticated`
-- may write businesses.site_mode or websites.published. Verification query in
-- §9.2 enumerates them.
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
-- + delete returns nothing). Cascade deletes from businesses are performed by
-- the referential-integrity system, which does not consult the invoking role's
-- DELETE privilege.
revoke delete on public.websites from anon, authenticated;

-- businesses INSERT is deliberately NOT guarded: the wizard
-- (lib/actions/business.ts:96-108, RLS client) legitimately inserts a
-- plan-validated site_mode at :71-73, and a raw PostgREST INSERT of
-- site_mode='store' is now genuinely defused — the storefront cannot be
-- published (1c covers INSERT *and* UPDATE, DELETE is revoked), and
-- /s/[slug] resolves only published rows (getPublicSiteBasicsBySlug,
-- lib/services/website.service.ts:70-78).
--
-- CODE CHANGES THIS FORCES — both required, do not apply §1 without them:
--   1. lib/services/website.service.ts:41 setWebsitePublishState must move from
--      createClient() to createServiceRoleClient(). Safe: ownership is already
--      proven before it is reached — publishWebsiteAction reads
--      getWebsite(businessId) (RLS client) at lib/actions/website.ts:81 on BOTH
--      branches. Keep the 23505 → "הכתובת הזו כבר תפוסה" translation verbatim.
--   2. lib/actions/site-mode.ts must be DELETED. setSiteModeAction has ZERO
--      call sites (grep-verified: the only hit is its own definition at :24),
--      it writes site_mode on the RLS client at :49 so it would now throw, and
--      leaving it beside admin_set_site_mode means two divergent definitions of
--      "change the mode".


-- ══ 2. Operator identity ═══════════════════════════════════════════════════

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  label       text not null,
  require_mfa boolean not null default false,   -- flipped to true in build step 5
  disabled_at timestamptz,                      -- break-glass, no deploy needed
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security; -- no policies: definer-only

-- Loud seed. `on conflict do nothing` over a WHERE that matches no rows is a
-- silent no-op, and on a branch DB or restored project that leaves /admin
-- permanently unreachable behind a 404 indistinguishable from the intended
-- non-disclosure behaviour.
do $$
declare n int;
begin
  insert into public.platform_admins (user_id, label)
  select id, 'founder'
  from auth.users
  where id = '9d1bba47-ad47-440f-a683-89db23360f27'   -- lib/quota.ts:33
  on conflict (user_id) do nothing;
  get diagnostics n = row_count;
  if n = 0 and not exists (select 1 from public.platform_admins) then
    raise exception
      'platform_admins seeded empty — /admin would be unreachable; insert the operator uuid manually';
  end if;
end $$;

create or replace function public.is_platform_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.disabled_at is null
  );
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- requireOperator() needs require_mfa + label, which the RLS client cannot read
-- (zero policies). This is the only way out of the table for a user session.
create or replace function public.platform_admin_self()
returns jsonb
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('is_admin', true,
                               'require_mfa', pa.require_mfa,
                               'label', pa.label)
       from public.platform_admins pa
      where pa.user_id = auth.uid() and pa.disabled_at is null),
    jsonb_build_object('is_admin', false));
$$;
revoke all on function public.platform_admin_self() from public, anon;
grant execute on function public.platform_admin_self() to authenticated;


-- ══ 3. Durable operator grants ═════════════════════════════════════════════
-- ONE table, discriminated by `kind`, so the operator has a single place to
-- enumerate everything they have given away.
--
-- Scoped per OWNER, matching enforcement: generation/chat quota is summed
-- across every business the owner has (lib/quota.ts:121-144, consumed at :163),
-- so a per-business count grant CANNOT be expressed correctly. The USD cost cap
-- is per BUSINESS (lib/quota.ts:242-282). The scope CHECK encodes that
-- asymmetry so the console physically cannot express a grant the enforcer would
-- silently ignore.
--
-- expires_at is timestamptz, NOT a usage-period string: currentPeriod() is
-- toISOString().slice(0,7), a UTC 'YYYY-MM' (lib/quota.ts:39-41), so anything
-- keyed to "this period" dies at 02:00/03:00 Israel time on the 1st.
--
-- expires_at is NULLABLE FOR plan_tier ONLY. A plan_tier grant is what makes an
-- upgraded store manageable; site_mode never expires and cannot be demoted, so
-- an expiring tier grant would leave a live storefront still taking
-- cash-on-delivery orders (placeStoreOrder gates only on websites.published +
-- modeHasCommerce, lib/services/orders.service.ts:485-498; payment_methods
-- defaults to '["cod"]', 0037:14) that its owner can no longer administer:
-- UpgradeGate on the store screen, FeatureNotAllowedError on every store_full
-- write, publish refused. Count grants must always expire.
create table if not exists public.platform_grants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  business_id   uuid references public.businesses(id) on delete cascade,
  kind          text not null check (kind in (
                  'ai_generations',  -- additive to PlanDef.aiGenerations
                  'ai_chat_msgs',    -- additive to PlanDef.chatMessages
                  'ai_cost_usd',     -- additive to PlanDef.monthlyCostCapUsd
                  'businesses',      -- additive to PlanDef.businesses
                  'plan_tier'        -- FLOOR on the effective tier
                )),
  amount        numeric,
  plan          public.plan_tier,    -- enum: free,starter,pro,business
  reason        text not null check (length(btrim(reason)) between 5 and 500),
  granted_by    uuid not null references auth.users(id) on delete restrict,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references auth.users(id) on delete set null,
  superseded_by uuid references public.platform_grants(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint platform_grants_shape check (
       (kind =  'plan_tier' and plan is not null and amount is null)
    or (kind <> 'plan_tier' and plan is null and amount is not null and amount > 0)
  ),
  -- ceilings that hold even if the TS layer is bypassed
  constraint platform_grants_sane check (
    amount is null or amount <= case kind
      when 'ai_generations' then 2000
      when 'ai_chat_msgs'   then 10000
      when 'ai_cost_usd'    then 200
      when 'businesses'     then 20
      else 0 end
  ),
  -- count/tier grants are owner-wide; only a cost grant may name a business
  constraint platform_grants_scope check (
    (kind = 'ai_cost_usd') = (business_id is not null)
  ),
  constraint platform_grants_window check (
    (kind = 'plan_tier' or expires_at is not null)
    and (expires_at is null
         or (expires_at > created_at and expires_at <= created_at + interval '400 days'))
  )
);
alter table public.platform_grants enable row level security; -- no policies

-- Exactly ONE live grant per (owner, kind, business scope). Forces
-- supersede-not-stack semantics, so a double-submitted form or a retried
-- half-failed upgrade can never silently double a grant and can never leave a
-- second live row that revokeGrantAction misses. The predicate is
-- `revoked_at is null` only — now() is not IMMUTABLE and cannot appear in an
-- index predicate — so admin_grant explicitly revokes the superseded row.
create unique index if not exists platform_grants_one_live_idx
  on public.platform_grants
     (user_id, kind, coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

create index if not exists platform_grants_live_idx
  on public.platform_grants (user_id) where revoked_at is null;


-- ══ 4. Audit trail ═════════════════════════════════════════════════════════
-- First audit surface of its kind: to_regclass('public.admin_audit_log') is
-- null, and the only *_log table in all 82 migrations is email_log (0063:38),
-- which is business-scoped and OWNER-READABLE — an operator audit customers can
-- read leaks operator activity. agent_logs is equally unsuitable: its
-- business_id FK cascades on business delete, so removing a customer would
-- erase the record of what was done to them.
create table if not exists public.admin_audit_log (
  id                   uuid primary key default gen_random_uuid(),
  actor_user_id        uuid not null references auth.users(id) on delete restrict,
  action               text not null,
  target_user_id       uuid references auth.users(id) on delete set null,
  target_business_id   uuid references public.businesses(id) on delete set null,
  target_email         text,   -- denormalised snapshot: survives the FK going null
  target_business_name text,
  before               jsonb,  -- pre-image: what makes actions revertible
  after                jsonb,
  reason               text not null check (length(btrim(reason)) between 5 and 500),
  created_at           timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security; -- no policies

create index if not exists admin_audit_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_actor_idx   on public.admin_audit_log (actor_user_id, created_at desc);
create index if not exists admin_audit_target_idx  on public.admin_audit_log (target_user_id, created_at desc);
create index if not exists admin_audit_action_idx  on public.admin_audit_log (action, created_at desc);

-- PRIVILEGE SURGERY. ALTER DEFAULT PRIVILEGES in schema public grants
-- arwdDxtm to postgres, anon, authenticated AND service_role (verified in
-- pg_default_acl), so a new table silently inherits full DML + TRUNCATE for all
-- four roles and "RLS with zero policies" is the ONLY thing standing between
-- `authenticated` and these tables. The `D` bit is TRUNCATE, which is subject
-- to neither row security nor FOR EACH ROW triggers.
revoke all on public.platform_admins, public.platform_grants, public.admin_audit_log
  from anon, authenticated, service_role;
grant select on public.platform_admins, public.platform_grants, public.admin_audit_log
  to service_role;   -- console READS only; every write goes through a definer RPC

-- Append-only, enforced in the database. Triggers fire for service_role (which
-- bypasses RLS, not triggers), so the trail survives theft of
-- SUPABASE_SERVICE_ROLE_KEY itself. This is why there is no mutable `outcome`
-- column: multi-step actions record a *.begin row and a *.complete row.
create or replace function public.admin_audit_immutable()
returns trigger language plpgsql security invoker set search_path = public as $$
begin raise exception 'admin_audit_log is append-only' using errcode = '42501'; end $$;

drop trigger if exists trg_admin_audit_immutable on public.admin_audit_log;
create trigger trg_admin_audit_immutable
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_immutable();

drop trigger if exists trg_admin_audit_no_truncate on public.admin_audit_log;
create trigger trg_admin_audit_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_immutable();


-- ══ 5. Mutation RPCs — atomicity + unforgeable actor ═══════════════════════
-- supabase-js cannot open a multi-statement transaction, so writing via plain
-- service-role queries would make the audit insert best-effort — precisely the
-- failure mode that makes a trail worthless in the incident you built it for.

create or replace function public.admin_grant(
  p_user    uuid,
  p_business uuid,
  p_kind    text,
  p_amount  numeric,
  p_plan    public.plan_tier,
  p_expires timestamptz,
  p_reason  text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_recent int; v_email text; v_name text; v_grant uuid; v_prev uuid;
  k_null constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;

  -- Serialize this actor's grants so the 24h ceiling is exact. checkRateLimit
  -- (lib/rate-limit.ts:22-26) FAILS OPEN by explicit design and can never be
  -- the control that stops a privileged write.
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  select count(*) into v_recent from admin_audit_log
   where actor_user_id = v_actor and action like 'grant.%'
     and created_at > now() - interval '24 hours';
  if v_recent >= 20 then
    raise exception 'daily grant limit reached' using errcode = '54000';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user;
  if p_business is not null then
    select b.name into v_name from businesses b where b.id = p_business;
  end if;

  -- Supersede any live grant of the same kind + scope (idempotency).
  update platform_grants
     set revoked_at = now(), revoked_by = v_actor
   where user_id = p_user and kind = p_kind
     and coalesce(business_id, k_null) = coalesce(p_business, k_null)
     and revoked_at is null
  returning id into v_prev;

  insert into platform_grants (user_id, business_id, kind, amount, plan,
                               reason, granted_by, expires_at)
  values (p_user, p_business, p_kind, p_amount, p_plan, p_reason, v_actor, p_expires)
  returning id into v_grant;

  if v_prev is not null then
    update platform_grants set superseded_by = v_grant where id = v_prev;
  end if;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_email, target_business_name, before, after, reason)
  values (v_actor, 'grant.' || p_kind, p_user, p_business, v_email, v_name,
          case when v_prev is null then null
               else jsonb_build_object('superseded_grant_id', v_prev) end,
          jsonb_build_object('grant_id', v_grant, 'kind', p_kind,
                             'amount', p_amount, 'plan', p_plan,
                             'expires_at', p_expires),
          p_reason);
  return v_grant;
end $$;
revoke all on function public.admin_grant(uuid,uuid,text,numeric,public.plan_tier,timestamptz,text)
  from public, anon, service_role;
grant execute on function public.admin_grant(uuid,uuid,text,numeric,public.plan_tier,timestamptz,text)
  to authenticated;


create or replace function public.admin_revoke_grant(p_grant uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); g platform_grants%rowtype; v_email text;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;

  select * into g from platform_grants where id = p_grant for update;
  if not found then raise exception 'grant not found'; end if;
  if g.revoked_at is not null then return; end if;         -- idempotent

  select u.email into v_email from auth.users u where u.id = g.user_id;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_email, before, after, reason)
  values (v_actor, 'grant.revoke', g.user_id, g.business_id, v_email,
          to_jsonb(g), null, p_reason);

  update platform_grants set revoked_at = now(), revoked_by = v_actor
   where id = p_grant;
end $$;
revoke all on function public.admin_revoke_grant(uuid,text) from public, anon, service_role;
grant execute on function public.admin_revoke_grant(uuid,text) to authenticated;


create or replace function public.admin_set_site_mode(
  p_business uuid, p_mode text, p_reason text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_old text; v_owner uuid; v_name text; v_r int; v_nr int;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;

  select site_mode, owner_id, name into v_old, v_owner, v_name
    from businesses where id = p_business for update;
  if not found then raise exception 'business not found'; end if;

  if v_old = p_mode then return 'noop'; end if;            -- idempotent retry

  -- Refused in SQL, not only in TS: a landing business's page_home is the
  -- synthetic landingCompatHome stub and page_about/services/contact/faq are
  -- NULL, because landing copy lives in websites.page_landing by design
  -- (0078:8-9). Flipping it ships a near-empty storefront to a paying customer.
  if v_old = 'landing' then
    raise exception 'landing→other requires a rebuild; use the manual procedure'
      using errcode = '42501';
  end if;

  -- ladder mirrors siteModeRank (lib/entitlements.ts:165-173)
  v_r  := case v_old  when 'landing' then 0 when 'website' then 1 when 'store' then 2 end;
  v_nr := case p_mode when 'landing' then 0 when 'website' then 1 when 'store' then 2 end;
  if v_nr is null then raise exception 'invalid site_mode'; end if;

  -- One-directional, matching lib/services/billing.service.ts:169-183.
  if v_nr <= v_r then
    raise exception 'site_mode is upgrade-only from the console' using errcode = '42501';
  end if;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_business_name, before, after, reason)
  values (v_actor, 'site_mode.upgrade', v_owner, p_business, v_name,
          jsonb_build_object('site_mode', v_old),
          jsonb_build_object('site_mode', p_mode), p_reason);

  update businesses set site_mode = p_mode where id = p_business;
  return 'changed';
end $$;
revoke all on function public.admin_set_site_mode(uuid,text,text) from public, anon, service_role;
grant execute on function public.admin_set_site_mode(uuid,text,text) to authenticated;


-- Also the RESTORE path: the operator passes a `before->'module_config'` blob
-- read out of an audit row and it is written back through this same function.
create or replace function public.admin_set_module_config(
  p_business uuid, p_config jsonb, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_old jsonb; v_owner uuid; v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;
  -- FOR UPDATE closes the last-write-wins race with the owner's own picker
  -- (saveModuleConfigAction → lib/actions/modules.ts persist(), which writes
  -- the whole map).
  select module_config, owner_id, name into v_old, v_owner, v_name
    from businesses where id = p_business for update;
  if not found then raise exception 'business not found'; end if;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_business_name, before, after, reason)
  values (v_actor, 'module_config.set', v_owner, p_business, v_name,
          jsonb_build_object('module_config', v_old),
          jsonb_build_object('module_config', p_config), p_reason);

  update businesses set module_config = p_config where id = p_business;
end $$;
revoke all on function public.admin_set_module_config(uuid,jsonb,text) from public, anon, service_role;
grant execute on function public.admin_set_module_config(uuid,jsonb,text) to authenticated;


-- Section ORDER. Default layout_style is 'flow', which renders the store 4th
-- (after benefits/about/services) — lib/site-layout.ts:63-79. 'showcase' is the
-- store-first arrangement. Value validation happens in TS against
-- Object.keys(SITE_LAYOUTS); the RPC only rejects empty.
create or replace function public.admin_set_layout_style(
  p_business uuid, p_layout text, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_old text; v_owner uuid; v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;
  if p_layout is null or btrim(p_layout) = '' then
    raise exception 'invalid layout_style';
  end if;

  select w.layout_style, b.owner_id, b.name into v_old, v_owner, v_name
    from websites w join businesses b on b.id = w.business_id
   where w.business_id = p_business for update of w;
  if not found then raise exception 'website not found'; end if;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_business_name, before, after, reason)
  values (v_actor, 'layout_style.set', v_owner, p_business, v_name,
          jsonb_build_object('layout_style', v_old),
          jsonb_build_object('layout_style', p_layout), p_reason);

  update websites set layout_style = p_layout where business_id = p_business;
end $$;
revoke all on function public.admin_set_layout_style(uuid,text,text) from public, anon, service_role;
grant execute on function public.admin_set_layout_style(uuid,text,text) to authenticated;


-- Un-stick a permanently hung job. APPENDS to jobs.error rather than replacing
-- it: setJobStatus (lib/services/job.service.ts:46-58) unconditionally writes
-- `error: extra?.error ?? null`, so a naive reuse would destroy the diagnostic
-- text the operator was reading — and it runs on the RLS client, so an
-- operator's write would match zero rows and appear to succeed.
-- Does NOT requeue: there is no worker and no queue consumer anywhere in this
-- repo (jobs only advance inside an HTTP request a browser tab holds open —
-- components/business/generation-watcher.tsx, maxDuration 120), so 'queued'
-- would sit forever.
create or replace function public.admin_unstick_job(
  p_job uuid, p_business_status text, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); j jobs%rowtype; v_owner uuid; v_name text; v_bstatus text;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;

  select * into j from jobs where id = p_job for update;
  if not found then raise exception 'job not found'; end if;

  select owner_id, name, status::text into v_owner, v_name, v_bstatus
    from businesses where id = j.business_id for update;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_business_name, before, after, reason)
  values (v_actor, 'job.unstick', v_owner, j.business_id, v_name,
          jsonb_build_object('job_status', j.status, 'job_error', j.error,
                             'business_status', v_bstatus),
          jsonb_build_object('job_status', 'failed',
                             'business_status', coalesce(p_business_status, v_bstatus)),
          p_reason);

  update jobs
     set status = 'failed',
         error  = coalesce(j.error || E'\n', '')
                  || '[operator] שוחרר ידנית על ידי המוקד ' || now()::text
   where id = p_job;

  -- business-plan.ts:65 deliberately leaves businesses.status='generating' on
  -- failure; leaving it means the overview keeps rendering GenerationWatcher
  -- and the customer stays stuck anyway.
  if p_business_status is not null and v_bstatus = 'generating' then
    update businesses set status = p_business_status::business_status
     where id = j.business_id;
  end if;
end $$;
revoke all on function public.admin_unstick_job(uuid,text,text) from public, anon, service_role;
grant execute on function public.admin_unstick_job(uuid,text,text) to authenticated;


-- The 20-generations-per-hour-per-business burst limiter (lib/ai/run.ts:42-44)
-- is plan-blind, unaffected by any package/add-on/grant, has its own Hebrew
-- message, and NOTHING in the codebase resets it: rate_limits is RLS-enabled
-- with zero policies (0010:11) and bump_rate_limit is revoked from
-- public/anon/authenticated (0010:34).
create or replace function public.admin_clear_burst_limit(p_business uuid, p_reason text)
returns int
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_owner uuid; v_name text; v_n int;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;
  select owner_id, name into v_owner, v_name from businesses where id = p_business;

  delete from rate_limits
   where key in ('ai_gen:' || p_business::text, 'chat:' || p_business::text);
  get diagnostics v_n = row_count;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_business_name, before, after, reason)
  values (v_actor, 'burst_limit.clear', v_owner, p_business, v_name,
          jsonb_build_object('rows_deleted', v_n), null, p_reason);
  return v_n;
end $$;
revoke all on function public.admin_clear_burst_limit(uuid,text) from public, anon, service_role;
grant execute on function public.admin_clear_burst_limit(uuid,text) to authenticated;


-- Plain audit-row writer: *.begin / *.complete markers, fault.ack /
-- fault.unack, and the PII-reveal record.
create or replace function public.admin_note(
  p_action text, p_user uuid, p_business uuid, p_detail jsonb, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_id uuid; v_email text; v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;
  if p_user is not null then
    select u.email into v_email from auth.users u where u.id = p_user;
  end if;
  if p_business is not null then
    select b.name into v_name from businesses b where b.id = p_business;
  end if;

  insert into admin_audit_log (actor_user_id, action, target_user_id,
    target_business_id, target_email, target_business_name, after, reason)
  values (v_actor, p_action, p_user, p_business, v_email, v_name, p_detail, p_reason)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.admin_note(text,uuid,uuid,jsonb,text) from public, anon, service_role;
grant execute on function public.admin_note(text,uuid,uuid,jsonb,text) to authenticated;


-- ══ 6. Index for the cross-tenant fault feed ═══════════════════════════════
-- jobs has idx_jobs_business + idx_jobs_status (0002:53-54) but nothing serving
-- "every unhealthy job across all tenants, newest first" — the board's home
-- query. Free at 9 businesses / 57 jobs; here so it does not become a seq-scan.
create index if not exists idx_jobs_unhealthy
  on public.jobs (updated_at desc)
  where status in ('queued'::job_status, 'running'::job_status, 'failed'::job_status);


-- ══ DOWN-PATH — no git. Keep this next to the migration. ═══════════════════
-- ORDER MATTERS: revert the APPLICATION CODE FIRST. After §7 of the spec lands,
-- lib/quota.ts getPlanForUser reads platform_grants and does not swallow the
-- error, so dropping the table before redeploying breaks all AI for everyone.
--
-- drop index if exists public.idx_jobs_unhealthy;
-- drop function if exists public.admin_note(text,uuid,uuid,jsonb,text);
-- drop function if exists public.admin_clear_burst_limit(uuid,text);
-- drop function if exists public.admin_unstick_job(uuid,text,text);
-- drop function if exists public.admin_set_layout_style(uuid,text,text);
-- drop function if exists public.admin_set_module_config(uuid,jsonb,text);
-- drop function if exists public.admin_set_site_mode(uuid,text,text);
-- drop function if exists public.admin_revoke_grant(uuid,text);
-- drop function if exists public.admin_grant(uuid,uuid,text,numeric,public.plan_tier,timestamptz,text);
-- drop trigger  if exists trg_admin_audit_no_truncate on public.admin_audit_log;
-- drop trigger  if exists trg_admin_audit_immutable   on public.admin_audit_log;
-- drop function if exists public.admin_audit_immutable();
-- drop table    if exists public.admin_audit_log;      -- DESTROYS THE TRAIL
-- drop table    if exists public.platform_grants;
-- drop function if exists public.platform_admin_self();
-- drop function if exists public.is_platform_admin();
-- drop table    if exists public.platform_admins;
-- drop trigger  if exists trg_guard_publish   on public.websites;
-- drop trigger  if exists trg_guard_site_mode on public.businesses;
-- drop function if exists public.assert_platform_controlled_write();
-- grant delete on public.websites to anon, authenticated;
-- grant update on public.profiles to anon, authenticated;
--   ↳ and revert lib/services/website.service.ts:41 to createClient().

-- ══ THEN: regenerate types/database.ts (generate_typescript_types). ════════
```

---

## 4. New / changed files

### New

| Path | What it does | Why it is needed |
|---|---|---|
| `supabase/migrations/0083_platform_operator_console.sql` | §3 above | The whole data model + the three privilege fixes |
| `lib/auth/platform-admin.ts` | `requireOperator()`, `withOperator()`, `Operator` type | The gate. `withOperator` makes the per-action check structurally impossible to omit |
| `lib/services/admin/client.ts` | `adminDb()` (the only sanctioned `createServiceRoleClient()` in console code), `adminRpc(name, args)` (calls the definer RPCs on the **RLS** client via `createClient()`), `resolveEmails(userIds)` (one `auth.admin.listUsers({page:1,perPage:200})` → id→email Map) | Single choke point. `auth.users` is not queryable by `service_role`, so emails must come from the Admin API — and N× `getUserById` is the N+1 already present at `lib/services/members.service.ts:85` |
| `lib/services/admin/health.service.ts` | All fault classifiers (§6.1). Returns `Fault[]` with `{key, scope, severity, title_he, detail, rawError, ageMs, businessId, userId, remediation}` | Nothing in the repo computes cross-tenant health; every source table is gated by `is_business_owner()` so no owner-side service is reusable |
| `lib/services/admin/roster.service.ts` | `listCustomers()` — profiles + effective plan + live grants + usage + business count + fault-count badge; search by email / business name / slug | `listBusinesses()` (`business.service.ts:14-22`) is RLS-scoped and must not be reused |
| `lib/services/admin/upgrade.service.ts` | `upgradeToStore(op, businessId, opts)` — the ordered procedure of §5.2 | Order is load-bearing; it must live in one place |
| `lib/services/admin/audit.service.ts` | `listAudit(filter)`, `latestAckFor(faultKeys)`, `openBeginMarkers()` | Board ack-filtering + the half-finished-action fault |
| `lib/services/grants.service.ts` | `getActiveGrants(userId): Promise<ActiveGrants>` — service-role read of live `platform_grants`. **Throws on error; is not `.catch`-swallowed** | Read on the *customer* path, so it is not under `admin/`. Not swallowed because a silently evaporating grant is exactly the `getActiveAddons` bug at `lib/quota.ts:93` |
| `lib/actions/admin.ts` | All 11 actions, every export a `withOperator(...)` product, house style `{ ok?, error?: string }` with Hebrew messages | Server actions are the only place `revalidatePath` works immediately (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md:18`) |
| `app/(admin)/layout.tsx` | `await requireOperator()`, RTL shell, top nav | **Separate route group** from `(dashboard)` — must not inherit the BusinessSwitcher |
| `app/(admin)/admin/page.tsx` | The triage board | §6 |
| `app/(admin)/admin/customers/page.tsx` | Roster | §6 |
| `app/(admin)/admin/customers/[userId]/page.tsx` | The one customer screen | §6 |
| `app/(admin)/admin/customers/[userId]/businesses/[businessId]/page.tsx` | Per-business drill-down | §6 |
| `app/(admin)/admin/audit/page.tsx` | The trail | §6 |
| `app/api/cron/operator-digest/route.ts` | Daily push of *changed* faults to the operator's inbox | The console is otherwise pull-only — the same failure mode that let 9 booking reminders die unnoticed since 2026-07-20 |
| `components/admin/fault-row.tsx`, `fault-badge.tsx`, `grant-form.tsx`, `grant-list.tsx`, `upgrade-to-store-dialog.tsx`, `audit-row.tsx`, `customer-contact.tsx`, `what-customer-sees.tsx` | RTL UI, reusing `components/ui/*` | §6 |
| `tests/grants.test.ts` | Unit tests for the pure `applyGrantsToPlan` + tier-floor resolution, modelled on `tests/addons.test.ts` | `applyGrantsToPlan` is pure and DB-free precisely so it is testable without a live DB |

### Changed

| Path | Change | Why |
|---|---|---|
| `lib/quota.ts` | `export function applyGrantsToPlan(plan, grants)` (pure, next to `applyAddonsToPlan:64`); `getPlanForUser:87-100` gains tier-floor resolution + grants; `getPlanForBusiness:102-106` adds the business-scoped cost grant | **The entire quota integration.** One hook, because `assertQuota:150`, `assertUnderCostCap:272`, `checkBusinessQuota:318`, `checkPublishQuota:332` and every `planAllows()` already funnel through it |
| `lib/services/website.service.ts:41` | `setWebsitePublishState` → `createServiceRoleClient()`. Keep the 23505 translation | Required by `trg_guard_publish`. Safe: `getWebsite` (RLS) proves ownership first at `lib/actions/website.ts:81` on both branches |
| `lib/supabase/middleware.ts:55` | `|| pathname.startsWith("/admin")` | Optimistic pre-filter |
| `lib/services/billing.service.ts` | **new export** `checkBillingConfig(): Promise<Array<{tier, ok, message?}>>` — non-throwing wrapper around `isBillingConfigured():17` + `assertPriceMatchesPlan():56` for starter/pro/business | `assertPriceMatchesPlan` is private and *throws*; its Hebrew string is currently only ever seen by the customer as a checkout toast |
| `app/api/cron/daily-brief/route.ts:35-43` | Replace the direct `profiles.plan` read with `getPlanForUser(ownerId)` per owner (≤20) | It is structurally blind to grants; a comped `business` tier would not get the brief the confirm dialog promises |
| `app/(marketing)/pricing/page.tsx:20-25` | `currentPlan = (await getPlanForUser(user.id)).tier` | Same bug: `/pricing` would show the old package while `/settings` shows the comped one |
| `app/(dashboard)/settings/page.tsx:37-47` | Pass `granted` + `grantExpiresAt` per usage row from `getActiveGrants(user.id)` | So a grant reads as `200 + 50 מתנה` instead of a bare `250` |
| `components/billing/subscription-card.tsx` | `UsageRow` gains `granted?: number; grantExpiresAt?: string | null`; render one muted line under the bar | ditto |
| `app/sitemap.ts` | add `export const revalidate = 3600` | Nothing revalidates the sitemap; a store upgrade's up-to-3000 product URLs would not ship until the next manual deploy |
| `vercel.json` | add `{"path":"/api/cron/operator-digest","schedule":"0 6 * * *"}` | Push, not pull |
| `types/database.ts` | Regenerate (`generate_typescript_types`) | New tables + RPCs |

### Deleted

| Path | Why |
|---|---|
| `lib/actions/site-mode.ts` | `setSiteModeAction` has **zero call sites** (grep-verified; only its own definition at `:24`), writes `site_mode` on the RLS client at `:49` so `trg_guard_site_mode` makes it throw, and it enforces `planAllowsSiteMode` — exactly the check the operator path must bypass. Two divergent definitions of "change the mode" is a trap |

### The quota integration, precisely

```ts
// lib/quota.ts — pure, unit-tested, mirrors applyAddonsToPlan's non-finite guards
export type GrantBonus = { aiGenerations: number; chatMessages: number; businesses: number };

export function applyGrantsToPlan(plan: PlanDef, g: GrantBonus): PlanDef {
  let next = plan;
  if (g.aiGenerations > 0 && Number.isFinite(next.aiGenerations))
    next = { ...next, aiGenerations: next.aiGenerations + g.aiGenerations };
  if (g.chatMessages > 0 && Number.isFinite(next.chatMessages))
    next = { ...next, chatMessages: next.chatMessages + g.chatMessages };
  if (g.businesses > 0 && Number.isFinite(next.businesses))
    next = { ...next, businesses: next.businesses + g.businesses };
  return next;
}

export async function getPlanForUser(userId: string): Promise<PlanDef> {
  const s = createServiceRoleClient();
  const { data } = await s.from("profiles").select("plan").eq("id", userId).maybeSingle();
  const baseTier = (data?.plan as PlanTier) ?? "free";

  const grants = await getActiveGrants(userId);            // throws — not swallowed
  const tier =
    grants.planTier && PLAN_ORDER.indexOf(grants.planTier) > PLAN_ORDER.indexOf(baseTier)
      ? grants.planTier
      : baseTier;                                          // FLOOR, never a demotion

  const addons = await getActiveAddons(userId).catch(() => new Set<string>());
  const plan = applyGrantsToPlan(applyAddonsToPlan(PLANS[tier], addons), grants.bonus);
  //                              ^ addons FIRST so ai_boost doubles the tier's base,
  //                                then the operator's bonus is added on top.

  if (UNLIMITED_BUSINESS_USERS.has(userId)) return { ...plan, businesses: Infinity };
  return plan;
}
```

`getPlanForBusiness` then adds the business-scoped cost grant: `monthlyCostCapUsd + (grants.costUsdByBusiness.get(businessId) ?? 0)` when the base is finite.

---

## 5. Operator actions, as procedures

All eleven actions live in `lib/actions/admin.ts`, all wrapped in `withOperator`, all taking a mandatory `reason` (5–500 chars, CHECK-enforced in SQL). All RPC calls go through `adminRpc()` on the **RLS client**.

### 5.1 `grantQuotaAction` — requirement (b), the "נגמר לי ה-AI" ticket

`grantQuotaAction(userId, kind, amount, reason, expiresAt)` where `kind ∈ {ai_generations, ai_chat_msgs, businesses}`.

**Preconditions**
- Operator verified.
- `amount > 0` and within the SQL ceiling (2000 / 10000 / 20).
- `expiresAt` non-null. Form default = **end of the current UTC period**: `Date.UTC(y, m+1, 1)`. Rationale: usage resets each UTC month (`currentPeriod()`, `lib/quota.ts:39-41`) while the grant raises the *limit* until it expires — a 30-day grant issued 20 Aug silently pays twice (Aug + Sep).
- The form has **no per-business selector** for these kinds: enforcement sums across every business the owner has (`lib/quota.ts:163` → `getMonthlyUsage:121-144`), and `platform_grants_scope` refuses to pretend otherwise.

**Steps**
1. `adminRpc('admin_grant', {p_user, p_business: null, p_kind, p_amount, p_plan: null, p_expires, p_reason})`. One transaction: operator re-check → advisory lock → 24h ceiling → supersede any live grant of the same kind → insert → audit row.
2. `revalidatePath('/settings')` and `revalidatePath('/businesses', 'layout')` — the customer's own screens read `getPlanForUser`.
3. Return `{ ok: true, grantId, effectiveBefore, effectiveAfter }`.

**Postconditions**
- Exactly one live `platform_grants` row for `(userId, kind, null)`.
- Effect is live on the customer's **very next AI call** — no cache, no cron.
- Usage counters untouched: the bar keeps rising, `ai_cost_usd` spend history survives, and `/settings` reads `200 + 50 מתנה`.

**If it half-fails** — it cannot. The RPC is one transaction; either the grant and its audit row both exist or neither does. A network failure after commit is safe to retry: the supersede clause makes a second identical call idempotent in effect (it revokes and re-creates, both audited).

**Undo** — `revokeGrantAction(grantId, reason)` → `admin_revoke_grant`. Immediate. Grants also self-expire.

**Three things the screen must say out loud**
1. **Nothing is metered in tokens.** `ai_generations` / `ai_chat_msgs` are `+1` counts (`0014:53-61`). Labels are `יצירות` and `הודעות`, never `טוקנים`.
2. This is per-**owner**, summed across all their businesses.
3. **Image generation is entirely unmetered** — `lib/services/image-gen.ts` calls no quota function at all. This grant does nothing for an images complaint.

**`ai_cost_usd` is implemented but hidden in v1's UI**: `pricingFor()` prices every `gemini*` model at $0 (`lib/ai/pricing.ts:19-21`) and FREE_MODE routes all text to Gemini, so the counter is structurally 0 and the grant would grant nothing. Shown behind a `מתקדם` disclosure with that sentence.

**Rejected mechanisms, for the record:** editing `usage_counters` (no decrement RPC — `bump_usage` is +1 only at `0014:53`, `add_ai_cost` rejects negatives at `0050:22`; needs N rows zeroed for a multi-business owner; destroys spend history; evaporates at the UTC rollover). Fabricating a `purchased_addons` `ai_boost` row (`stripe_subscription_id` is NOT NULL + UNIQUE at `0051:16,27` so you must forge a Stripe id; `markAddonCanceled` matches on that id at `addons.service.ts:82` so it could never be revoked; it is a ×2 boolean that cannot express "+50"; the customer's `/pricing` shows a paid add-on they were never billed for; the table has **0 rows in production**). Editing `lib/plans.ts:106/130/162` (global, needs a deploy).

### 5.2 `upgradeToStoreAction` — requirement (c). ONE guarded action

`upgradeToStoreAction(businessId, { reason, confirmLiveCheckout, tierExpiresAt? })`.

**Preconditions — two hard refusals before anything is written**
- **(i)** `resolveSiteMode(business.site_mode) === 'landing'` → refuse, return `{ needsRebuild: true }` and route to the manual procedure. Landing `page_home` is the synthetic `landingCompatHome` stub and `page_about/services/contact/faq` are NULL by design (`0078`). Also refused in SQL.
- **(ii)** `confirmLiveCheckout !== true` → refuse with the consequence spelled out: `businesses.payment_methods` defaults to `'["cod"]'` (`0037:14`) and `placeStoreOrder`'s only mode gate is `modeHasCommerce` (`lib/services/orders.service.ts:485-498`), so mode + one active product = a **public, unattended storefront accepting real cash-on-delivery orders**. This is a settings screen that turns on money.
- `tierExpiresAt` defaults to **null (non-expiring)**. A finite value is accepted only if explicitly passed, and the dialog then shows the store-goes-dark warning. See §3 §3 comment for why.

**Ordered steps** — order is load-bearing and verified: `app/(dashboard)/businesses/[businessId]/store/page.tsx:36-39` does `assertNavAllowed(site_mode,'store')` **then** `planAllows(plan,'store_basic')`, and `lib/actions/website.ts:73-78` blocks publish on `!planAllowsSiteMode`. Flip the mode first and you strand the customer: nav shows חנות, the store screen is an `UpgradeGate` so no product can be added, every `store_full` write throws (`store-payments.ts:39`, `coupon.ts:27`, `payment-gateways.ts:62`, `store-shipping.ts:35`), and their own publish button starts refusing with an upsell for the package you just gave them.

0. `admin_note('store_upgrade.begin', ownerId, businessId, {…}, reason)`.
1. **PLAN** — `admin_grant(p_user: ownerId, p_kind:'plan_tier', p_plan:'business', p_expires: tierExpiresAt, …)`.
   **Not a direct `profiles.plan` write.** `syncSubscriptionFromStripe` (`lib/services/billing.service.ts:143-158`) unconditionally rewrites `profiles.plan` on **every** subscription webhook from a tier read off subscription metadata stamped once at checkout creation (`:115`) and never refreshed — so a hand-written plan quietly reverts at the next renewal or card update, and because the promotion block at `:169-183` is one-directional, `site_mode` **stays** `store`: a live store on a plan that cannot manage it, with no alert anywhere. A grant lives in a table the webhook never touches.
2. **MODULES** — `admin_set_module_config(businessId, normalizeModuleConfig({...current, returns:{enabled:true,…}, order_tracking:{enabled:true,…}}), reason)`.
   Necessary because `runWebsiteJob` auto-curates **only when `module_config` is empty** (`lib/jobs/handlers/website.ts:100-108`), so any business that ever saved the picker keeps its brochure-era config — and `configFromRecommended` writes those two keys as explicit `{enabled:false}` for a website-mode business (`lib/modules.ts:214-231`) while `resolveModules` only defaults **absent** keys to on (`entry.enabled !== false`, `:138`). A present-and-false key stays off forever. Safe because both are `CORE_TOGGLE_KEYS` (`lib/modules.ts:94`) and exempt from `CURATED_MODULE_LIMIT` (`lib/entitlements.ts:130-135`).
3. **MODE** — `admin_set_site_mode(businessId, 'store', reason)`. Returns `'noop'` if already there (idempotent retry).
4. **REVALIDATE**
   - `revalidatePath('/businesses/' + businessId, 'layout')` — `BusinessNav` re-renders with the חנות item.
   - `revalidatePath('/settings')`.
   - `revalidatePath('/s/' + slug, 'layout')` after a `websites` lookup. **The `'layout'` scope**: the page-only form previously used at `lib/actions/site-mode.ts:55` does not cover `/s/[slug]/product/**`, `/blog/**`, `/help` or `/account`.
   - `revalidatePath('/sitemap.xml')`.
5. `admin_note('store_upgrade.complete', …)`.
6. **RETURN A CHECKLIST, not "done"**: active product count, `shipping_methods` count, `payment_methods`, `websites.layout_style`, and the owner's other businesses now on the `business` tier.

**Postconditions**
- `site_mode='store'`, live `plan_tier` grant, both store modules on, four paths revalidated, three audit rows (`begin`, the three sub-actions' own rows, `complete`).
- **Zero products is the headline of the checklist.** `sellsProducts = commerce && products.length > 0` (`app/s/[slug]/page.tsx:325`) gates the store section (`:540`), cart + wishlist drawers (`:897-898`), account icon (`:889`), `#store` nav link (`:760`), the hero's `לחנות שלנו` CTA (`:404`), the order-tracking block (`:594`) and the footer newsletter column (`:1015`). With an empty catalogue the ₪699 upgrade changes **literally nothing a visitor can see** — `שילמתי ₪699 ולא קרה כלום` is the single most likely ticket this console would otherwise generate. Registered as standing fault `store_without_products` so it cannot be forgotten.
- `layout_style` is on the checklist with a one-click `setStoreLayoutAction(businessId,'showcase',reason)`: the default `flow` renders the store **4th**, after benefits/about/services (`lib/site-layout.ts:63-79`). The checklist also states that `hero_style` is inherited from the brochure site and is **not** changed (`pickHeroStyle` never sees `site_mode`; `runWebsiteJob:59-62` only re-picks when unset or `'spotlight'`).

**If it half-fails** — three transactions, so a gap is possible. Every step is idempotent and the action is safe to re-run:
- step 1 supersedes rather than stacks (partial unique index), so no double grant;
- step 2 is a full-map write;
- step 3 returns `'noop'` when already at target.
The `store_upgrade.begin` with no matching `store_upgrade.complete` older than 15 minutes is itself surfaced on the board as fault `half_finished_action` (severity high) with a **Retry** button that re-runs the same action.

**Undo** — asymmetric, and the dialog says which parts *before* it runs:
- **Fully undoable:** the plan grant (`revokeGrantAction` — and because `profiles.plan` was never written there is no drift to unwind and no risk of the webhook and the console fighting over one column); `module_config` (a **Restore** button on the matching `/admin/audit` row reads `before->'module_config'` and writes it back through `admin_set_module_config`); `layout_style` (same shape).
- **Not undoable from the console:** `site_mode`. `admin_set_site_mode` raises on any rank-decreasing change. Demoting deletes a paying customer's storefront out from under them and hides an order history the owner still needs. The audit pre-image makes a reversal possible as a deliberate DB action by a human who has read it.
- **Never undone:** any order placed while the store was live.

**Blast radius, stated in the dialog:** a `plan_tier` grant is per-**owner**. Every gate resolves via `getPlanForBusiness → ownerIdOf → getPlanForUser` (`lib/quota.ts:102-106`), so comping one business unlocks `store_basic/store_full/hr/whatsapp_agent/ai_insights/all_modules` on **every** business that owner has, raises the module cap 8 → Infinity, and raises `aiGenerations` 200→600, `chatMessages` 1200→4000, `monthlyCostCapUsd` $30→$60. The dialog lists the owner's other businesses by name (the data is already loaded for the customer screen) and enumerates the tier's contents read out of `PLANS[]`, not from memory.

### 5.3 `triage` — requirement (a), the "האתר שלי לא עובד" ticket

Read-only. No mutation, no audit row. `lib/services/admin/health.service.ts` on `adminDb()`. Every source table is gated by `is_business_owner()` (`0067:48`), false for an operator — so **no owner-side service function is reusable**: `getBusiness`, `listBusinesses`, `getWebsite`, `upsertWebsite`, `setWebsitePublishState`, `createJob`, `getLatestJob`, `setJobStatus` all run on the RLS cookie client and return zero rows or silently affect zero rows.

**Reused as-is** (already service-role, take an explicit id): `getPlanForUser:87`, `getPlanForBusiness:102`, `getMonthlyUsage:121`, `getMonthlyCostForBusiness:242`, `getCostCapStatus:254`. **Pure and importable anywhere:** `lib/plans.ts`, `lib/entitlements.ts`, `lib/site-mode.ts`, `lib/modules.ts`, `lib/site-layout.ts`.

Fault taxonomy in §6.1. Each fault carries `key` (stable, e.g. `job:<uuid>`), `severity`, `ageMs`, the Hebrew string the customer is actually seeing where one exists, the raw provider error rendered verbatim in `dir="ltr"` and never translated, and its remediation action.

**Ack model** (the board's `שקט` filter — no mutable table, append-only preserved): `ackFaultAction(faultKey, ackedThrough, reason)` → `admin_note('fault.ack', …, {fault_key, acked_through})`. The board LEFT JOINs the newest `fault.ack` per key and hides the fault while `fault.lastSeen <= acked_through`. A recurrence with a newer `lastSeen` reappears. Un-acking is another row (`fault.unack`).

**Classifier hygiene, so acking is not needed for known-dead noise** (the board would otherwise open with 11 failed jobs + 29 failed `agent_logs` that are overwhelmingly the same dead `Your credit balance is too low` Anthropic error from a provider the platform no longer uses): collapse repeated identical `(business_id, agent, error)` failures into **one** row with a count and first/last-seen range, and mark rows whose `provider` is not the active provider as `ספק לא פעיל` at severity `low`.

**What the board cannot see is printed on the screen itself**, under a `מה לא נמדד` panel — because the most common ticket is "the AI stopped working" and the monthly quota is usually the wrong answer:
1. The 20/hour/business burst limiter (`lib/ai/run.ts:42-44`) is plan-blind with its own distinct Hebrew message; `rate_limits` stores only the **current** window counter (`0010:6`) — you can see who is near a limit now, never who was blocked yesterday.
2. Quota, cost-cap and rate-limit rejections all throw **before** the `generateObject` attempt, so they write no `agent_logs` row and no `jobs` row.
3. Non-structured AI (WhatsApp replies, store chat, CEO chat) never touches `agent_logs`.
4. Counters are unreliable in **both** directions — `bumpUsage`/`addAiCost` swallow every error (`lib/quota.ts:182-184, 294-296`) so a broken RPC leaves a customer looking healthy while generating without limit; the Gemini→Claude fallback re-enters `attempt()` (`lib/ai/run.ts:98-114`) so one user-visible generation can bump twice.
5. `agent_logs.cost_usd` is dead — `logAgentCall` (`lib/ai/run.ts:133`) never inserts it; all 401 live rows are null. `usage_counters.ai_cost_usd` is the only cost truth.
6. Client crashes, Stripe webhook failures, Israeli-gateway callback failures and SMS rejections persist nothing at all.

### 5.4 The remaining actions

| Action | Procedure | Undo |
|---|---|---|
| `unstickJobAction(jobId, reason)` | `admin_unstick_job(jobId, 'draft', reason)` → status `failed`, error **appended**, `businesses.status` cleared when `generating`. Then `revalidatePath('/businesses/'+businessId+'/website')`. **The confirm dialog must state**: `jobs` is in the `supabase_realtime` publication (`0015:7`) and the customer's open tab subscribes filtered by `business_id` (`hooks/use-job-watcher.ts:57-63`) — this write is pushed **live** into their browser and their spinner becomes a red error card mid-session, possibly while they are typing the support message. Before shipping, read `app/(dashboard)/businesses/[businessId]/overview/page.tsx` and confirm `status='draft'` renders the retry CTA; if not, pass the status that does. | No, and it does not need to be — the prior state was a permanent hang and the effect is to restore the customer's own retry button. The pre-image (old status, old error, old business status) is in the audit row and the original error text is preserved by concatenation. |
| `clearBurstLimitAction(businessId, reason)` | `admin_clear_burst_limit`. Show the current `rate_limits.count` next to the button so the operator can tell which wall they are looking at. | Self-healing — the row is recreated by the next request. The only cost is runaway-loop protection off for the rest of that hour, and `checkRateLimit` already fails open (`lib/rate-limit.ts:22-26`). |
| `revokeGrantAction(grantId, reason)` | `admin_revoke_grant` + revalidate `/settings`. Rendered inline beside every live grant with reason, actor and expiry countdown. | Re-grant. Both directions one row, both audited. |
| `setPlanGrantAction(userId, tier, reason, expiresAt)` | `admin_grant` with `kind='plan_tier'`, **without** the mode flip. For a customer who needs an entitlement (bookings, `whatsapp_agent`, `hr`) rather than a storefront. Stripe keeps writing `profiles.plan` freely; the comp survives every webhook; on expiry the customer falls back to whatever Stripe says with no cron. Dialog enumerates the tier's full contents from `PLANS[]` and the owner's other businesses. | `revokeGrantAction`. `profiles.plan` was never written. |
| `setStoreLayoutAction(businessId, layout, reason)` | Validate against `Object.keys(SITE_LAYOUTS)` in TS → `admin_set_layout_style` → `revalidatePath('/s/'+slug,'layout')`. | Yes — set it back; pre-image in the audit row. |
| `restoreModuleConfigAction(auditId, reason)` | Read `before->'module_config'` from the named audit row via `adminDb()`, re-normalize through `normalizeModuleConfig`, write via `admin_set_module_config`. Surfaced as a `שחזור` button on the matching `/admin/audit` row. | Yes — it is itself an audited write with its own pre-image. |
| `revealCustomerPiiAction(businessId, scope, reason)` | `admin_note('pii.reveal', ownerId, businessId, {scope}, reason)` **before** the data is returned. Gate for `orders.customer_name/phone/address`, `crm_leads`, `customer_profiles`, `whatsapp_conversations` content. | N/A — a read cannot be undone, which is why it is audited rather than merely gated. The audit row **is** the control. |
| `ackFaultAction` / `unackFaultAction` | `admin_note('fault.ack'/'fault.unack', …)` | Each other. |

**The PII boundary, drawn explicitly:** the business **owner** is the operator's own contracting counterparty, so owner email (`auth.admin.listUsers`) and `profiles.phone` are operator-visible **unaudited** — they appear on the roster and on the contact block. `revealCustomerPiiAction` is reserved strictly for **end-customer** data. That is also the defensible Amendment 13 position: the owner's data is first-party, the shoppers' is not. Note the existing error surfaces already leak personal data — live `email_log.error` rows embed the operator's own address, and failed sends to end customers would embed theirs — so raw provider errors are rendered verbatim for diagnosis and never copied into the new tables.

---

## 6. The screens — Hebrew, RTL

`app/(admin)/layout.tsx`: `dir="rtl"`, `lang="he"`, its own minimal chrome (title `מוקד`, top nav `לוח תקלות · לקוחות · יומן`, the operator's label, a `מצב קריאה בלבד` badge when `require_mfa` is true but the session is aal1 — unreachable, since `requireOperator` 404s, but present as a guard rail). **No `BusinessSwitcher`, no dashboard sidebar** — a separate route group precisely so it cannot inherit them.

### 6.1 `/admin` — לוח תקלות (the default landing screen)

Header strip: `4 תקלות פתוחות · 2 קריטיות · עודכן לפני 12 שניות`, a `רענן` button, and a `שקט` toggle (hides acked faults).

**Platform panel first** (`מערכת`), because these are the operator's own problems, not one tenant's:

| Key | Condition | Severity | Hebrew title |
|---|---|---|---|
| `billing_config:<tier>` | `checkBillingConfig()` reports not-configured | high | `החיוב לא מוגדר — לקוחות לא יכולים לקנות` |
| `billing_price:<tier>` | `checkBillingConfig()` reports mismatch | **critical** | the thrown string verbatim from `billing.service.ts:69-74` |
| `cron_daily_brief` | `max(brief_date) from daily_briefs < current_date` and ≥1 eligible business | high | `הבריף היומי לא רץ היום` |
| `cron_booking_reminders` | `count(bookings where starts_at between now()-6h and now()-90min and reminder_1h_sent_at is null) > 0` | high | `תזכורות התורים לא נשלחות` |
| `email_failing` | `email_log` rows with `status='failed'` in the last 7d | **critical** | `שליחת מיילים נכשלת` + the raw Resend error in `dir="ltr"` |
| `stripe_orphan:<subId>` | active Stripe subscription with no `public.subscriptions` row (only when `isBillingConfigured()`) | high | `מנוי פעיל ב-Stripe שלא נרשם במערכת` |

**Tenant faults**, severity-ordered, each row: `[badge] [Hebrew title] · [business name] · [owner email] · [age] · [remediation button]`, expandable to the raw error (`dir="ltr"`, monospace, never translated).

| Key | Condition | Severity | Remediation |
|---|---|---|---|
| `job:<id>` | `jobs.status='running'` and `updated_at < now()-30min` | **critical** | `שחרור תקיעה` |
| `biz_generating:<id>` | `businesses.status='generating'` and `updated_at < now()-30min` | **critical** | `שחרור תקיעה` |
| `grant_expiring:<grantId>` | store-mode business whose effective tier depends on a `plan_tier` grant expiring in <14d | **critical** | `הפיכה לקבוע` |
| `half_finished:<auditId>` | `*.begin` with no `*.complete`, older than 15min | high | `הרצה מחדש` |
| `job_failed:<biz>:<type>` | latest job per `(business,type)` is `failed` | high | `שחרור תקיעה` |
| `store_no_products:<biz>` | `site_mode='store'` and 0 active products | high | link to the owner's store screen + WhatsApp draft |
| `mode_above_plan:<biz>` | `siteModeRank(site_mode) >` what the effective plan allows | high | `שדרוג חבילה` |
| `published_no_plan:<biz>` | `websites.published` and `!effectivePlan.canPublish` | high | `שדרוג חבילה` |
| `wa_secret:<biz>` | `whatsapp_config.enabled` and `app_secret is null` | high | none (owner must reconnect) |
| `email_failed:<biz>` | per-business `email_log` failures, 7d | high | none |
| `wa_silent:<biz>` | `enabled`, secret present, `max(whatsapp_messages.created_at where direction='inbound')` null or `< now()-7d` | medium | `ייתכן שהחיבור ל-WhatsApp שבור` |
| `wa_waiting:<biz>` | `whatsapp_conversations.needs_reply` and `needs_reply_since < now()-24h` | medium | none |
| `card_pending:<biz>` | orders `payment_method='card'`, `payment_status='pending'`, `created_at < now()-2h` | medium | none (counts only) |
| `pay_mismatch:<biz>` | `orders.notes` contains the amount-mismatch marker — **read the literal prefix at `lib/services/store-checkout.service.ts:241` and match it; do not invent it** | high | none |
| `agent_fail:<biz>:<agent>` | collapsed `agent_logs` failures, 7d | medium (low if provider inactive) | none |
| `automation_fail:<biz>` | `automation_runs.status='failed'`, 7d | medium | none |
| `quota_wall:<user>` | usage ≥ effective limit this period | medium | `הענקת מכסה` |
| `never_published:<biz>` | `generated_at` set, `published=false`, business `ready`, >7d | low | none |

Bottom: the `מה לא נמדד` panel (§5.3).

On today's live data the board opens with: 1 job stuck `running` for 37 days, 1 business stuck `generating`, 11 failed jobs, 9-of-9 failed emails, and 29 `agent_logs` failures collapsed into a handful of `ספק לא פעיל` rows.

### 6.2 `/admin/customers` — לקוחות

One row per owner (5 live): `אימייל · חבילה בסיס → חבילה בפועל · מענקים פעילים · יצירות/הודעות מול התקרה בפועל · מס׳ עסקים · [badge תקלות]`. Search box `חיפוש לפי אימייל, שם עסק או כתובת אתר`. Email map comes from one `auth.admin.listUsers({page:1, perPage:200})` in `lib/services/admin/client.ts` — **state the 200 ceiling in a footnote** rather than silently truncating; revisit past ~200 users.

### 6.3 `/admin/customers/[userId]` — THE ONE SCREEN

Four stacked cards, built to answer all three inbound tickets without navigating.

1. **חבילה** — `profiles.plan`, `subscriptions.plan/status`, effective plan. When they disagree, an amber `אי-התאמה` line naming which is authoritative (`profiles.plan` is what every guard reads; `subscriptions` is never read by any entitlement code).
2. **מכסה** — the four numbers `app/(dashboard)/settings/page.tsx:41-46` already renders, but as `תקרה + מענק = בפועל`, plus `באיזה קיר הם נתקלו` (monthly quota / hourly burst / cost cap / not metered at all), plus the effective ceiling **per calendar month** when a grant spans a boundary (`אוגוסט: 250 · ספטמבר: 200`).
3. **עסקים** — one card per business: `site_mode`, does the plan allow it, published, slug (a live link to `https://<host>/s/<slug>` — public, so no privilege involved and it answers "is anything actually rendering" instantly), product count, `payment_methods`, `layout_style`, and its open faults. Plus a `מה הלקוח רואה` panel that evaluates the pure predicates server-side — `planAllows(plan,'store_basic')`, `planAllowsSiteMode`, `modeAllowsNav`, `canPublish` — and prints the exact Hebrew upsell string the customer would be shown. (No impersonation: that would need the RLS widening this design rejects.)
4. **פעולות + יומן** — the grant form, the upgrade button, the live-grant list with `ביטול` beside each, and this customer's last 20 audit rows inline so the operator sees what a past session already did before doing it again.

Contact block in the header: `wa.me/<profiles.phone normalized to E.164>` and `mailto:<email>`. Two links, zero backend work — WhatsApp is this platform's actual support channel and every remediation otherwise ends with a DB write the customer never hears about. `unstickJobAction` returns a **pre-written Hebrew message** the operator copies into WhatsApp.

**The grant form states, above the submit button:** `הלקוח לא יקבל הודעה — צריך לעדכן אותו.`

### 6.4 `/admin/customers/[userId]/businesses/[businessId]`

Full fault list; last 20 `agent_logs` rows; `jobs` history; `whatsapp_config` health; `automation_runs` failures; the derived faults; the `מה הלקוח רואה` panel; the public storefront link; and a `חשיפת פרטי לקוחות קצה` button that runs `revealCustomerPiiAction` with a mandatory reason.

### 6.5 `/admin/audit` — יומן פעולות

`מתי · מי · פעולה · לקוח · עסק · סיבה`, expandable to before/after JSON. Filter by action and by customer. `שחזור` button on `module_config.set` / `layout_style.set` rows. PII reveals appear here alongside writes, so operator **reads** of personal data are as visible as operator writes.

**Not built:** an `/admin/operators` screen (adding an operator is one INSERT via MCP); pagination and search indexes (9 businesses, 5 profiles — revisit at a few hundred).

---

## 7. Audit trail

**Where:** `public.admin_audit_log`. RLS enabled, **zero policies**, and `revoke all ... from anon, authenticated, service_role` + `grant select ... to service_role`. Following the `rate_limits` precedent (`0010:11`) rather than `email_log` or `automation_runs`, which are owner-readable — an operator audit customers can read leaks operator activity.

**What is recorded:** actor (from `auth.uid()`, unforgeable), action slug, target user + business, **denormalised** `target_email` / `target_business_name` snapshots, `before`/`after` JSONB, and a **mandatory** `reason` (CHECK, 5–500 chars) so a mutation without stated justification is impossible even if the TS layer is bypassed. For grants, `before`/`after` capture **effective** limits (post-tier-floor, post-addon, post-grant), because `aiGenerations 200 → 250` is what the operator needs to read in three months and `+50` is not. Pre-images are what make the actions revertible at all: old plan, old `site_mode`, old `module_config`, old `layout_style`, old job status + error.

**Atomic, not best-effort.** Every mutation is a single `SECURITY DEFINER` plpgsql RPC that inserts the audit row and performs the write in **one transaction**. `supabase-js` cannot open a multi-statement transaction, so writing via plain service-role queries would make the audit insert best-effort — precisely the failure mode that makes a trail worthless in the incident you built it for.

**No mutable `outcome` column**, deliberately, and this is the one genuine improvement over every input proposal. Attempt-recording (a pending row, so a half-finished action is visible) and immutability (you cannot UPDATE an append-only row) conflict directly. Resolution: multi-step actions record a `*.begin` row and a `*.complete` row, **both inserts**. A `begin` with no matching `complete` **is** the stale-pending signal, surfaced on the board as fault `half_finished_action`. Both properties, no mutable state.

**Who can delete it:** nobody reachable from the application, and nobody holding the service key.
- `trg_admin_audit_immutable` — `BEFORE UPDATE OR DELETE ... FOR EACH ROW`, unconditional raise.
- `trg_admin_audit_no_truncate` — `BEFORE TRUNCATE ... FOR EACH STATEMENT`. Necessary because `TRUNCATE` is subject to neither row security nor row-level triggers, and `ALTER DEFAULT PRIVILEGES` in schema `public` grants the `D` (TRUNCATE) bit to all four roles by default.
- Triggers fire for `service_role` (which bypasses RLS, **not** triggers), so the trail survives theft of `SUPABASE_SERVICE_ROLE_KEY` itself.
- The only paths that can destroy it are `postgres` via the Supabase MCP token, the dashboard SQL editor, or a pooler superuser credential — i.e. the same channel that applies migrations. **This is the residual risk and it is not closable from inside the application.** Treat the MCP/CI token as the crown jewel; the down-path's `drop table admin_audit_log` is flagged `DESTROYS THE TRAIL`.

**Operator rate limiting lives in the audit table**, not in `checkRateLimit`: `admin_grant` takes an advisory lock on the actor and counts their last 24h of `grant.%` rows inside its own transaction, raising at 20. `checkRateLimit` fails open by explicit design (`lib/rate-limit.ts:22-26`) and can never be the control that stops a privileged write.

**Reads are not audited**, with one deliberate exception: `revealCustomerPiiAction` writes a row **before** returning data.

**What audit cannot do:** before §1 of the migration lands, an audit row on a plan change proves nothing — `authenticated` holds table-level UPDATE (`arwdDxtm`) on `profiles`, `businesses` **and** `websites`, so the customer can write `profiles.plan`, `businesses.site_mode` and `websites.published` themselves and the log could not distinguish a granted upgrade from a stolen one. §1 is a **prerequisite** of the trail being meaningful, not a nice-to-have shipped alongside it.

---

## 8. Build order

Each step is independently shippable and independently verifiable. ~60% of the risk is in steps 1–2.

**Write the down-path (§3 tail) into the migration file before applying anything. There is no git to bisect a regression.**

| # | Step | Contents |
|---|---|---|
| **1** | **`profiles` privilege surgery, alone** | Apply §1a only (`revoke update on public.profiles from anon, authenticated;` + the column re-grant). Nothing else. |
| **2** | **The two guard triggers + their forced code changes, as ONE atomic deploy** | Apply §1b/§1c (trigger function, both triggers, `revoke delete on websites`) **together with** `setWebsitePublishState → createServiceRoleClient()` and the deletion of `lib/actions/site-mode.ts`. Applying the triggers without the code change breaks customer publishing. |
| **3** | **The rest of the migration** | §2–§6. Purely additive, nothing customer-facing. Then `generate_typescript_types` → `types/database.ts`. |
| **4** | **The gate, no screens** | `lib/auth/platform-admin.ts`, `lib/services/admin/client.ts`, `app/(admin)/layout.tsx` returning a stub, `lib/supabase/middleware.ts:55`. |
| **5** | **TOTP enrollment, out of band** | Enroll a factor on the founder account via a one-off `npx tsx --env-file=.env.local` script using `supabase.auth.mfa.enroll/challenge/verify`, then `update platform_admins set require_mfa = true where label='founder';`. Enrollment never happens at `/admin`, so no bootstrap route is needed and the console never exists in a single-factor state with write capability. |
| **6** | **The read-only board** | `health.service.ts`, `roster.service.ts`, `audit.service.ts`, `/admin`, `/admin/customers`, `/admin/customers/[userId]`, the drill-down, `/admin/audit`, `checkBillingConfig()`. **Zero mutations.** This alone pays for itself: it immediately surfaces the 37-day hung job, the business stuck at `generating`, the 9 undelivered booking reminders, and any Stripe price mismatch. |
| **7** | **Grants — the fully reversible verbs** | `lib/services/grants.service.ts`, `applyGrantsToPlan` + `getPlanForUser`/`getPlanForBusiness` in `lib/quota.ts`, `tests/grants.test.ts`, `grantQuotaAction`, `setPlanGrantAction`, `revokeGrantAction`, the grant form + list. |
| **8** | **Grant visibility on the customer side + the two direct-`profiles.plan` readers** | `subscription-card.tsx`, `settings/page.tsx`, `app/api/cron/daily-brief/route.ts`, `app/(marketing)/pricing/page.tsx`. |
| **9** | **The operational verbs** | `unstickJobAction`, `clearBurstLimitAction`, `ackFaultAction`/`unackFaultAction`, `restoreModuleConfigAction`, `revealCustomerPiiAction`, `setStoreLayoutAction`. |
| **10** | **The store upgrade — last, because it is the only verb that turns on real money** | `upgrade.service.ts`, `upgradeToStoreAction`, `UpgradeToStoreDialog`, `app/sitemap.ts` `revalidate`. |
| **11** | **Push, not pull** | `app/api/cron/operator-digest/route.ts` + the `vercel.json` cron entry. |

**Effort:** ~3.5–4 focused days, ~30 files, 1 migration, ~1,900 lines. No new npm dependencies.

**Step 11 detail** — copy the `CRON_SECRET` bearer check verbatim from `app/api/cron/booking-reminders/route.ts:19-22`, run the same `health.service.ts` classifiers the board uses, and email **only when the fault set has changed** since the last digest (store the previous fault fingerprint as `admin_note('digest.sent', null, null, {fingerprint, counts}, 'daily digest')` — append-only supports this). Deliver via the existing `sendEmail({ to, subject, html, kind: 'operator_digest' })` (`lib/services/email.service.ts:90`) with **no `businessId`**, so it logs platform-side (`email_log.business_id` is nullable and its RLS policy requires `business_id is not null`) and leaks to no tenant. Critically it **will deliver today** despite the unverified Resend domain: the live failure text is `You can only send testing emails to your own email address (apropo.ai@gmail.com)`, so the operator's own address is the one recipient Resend test mode permits. Fallback if Resend is swapped: `sendPushToUser(operatorUserId, …)` (`lib/services/push.service.ts:40`) works for any user id and needs no business scope.

---

## 9. Verification

Every check below is runnable in this repo: SQL via MCP `execute_sql`, HTTP via `curl` with the public anon key from `NEXT_PUBLIC_SUPABASE_ANON_KEY`, tests via `npm test`.

### 9.1 After step 1 — `profiles`

```sql
-- MUST show authenticated WITHOUT the `w` bit. This is the whole point:
-- the obvious column-only revoke would have failed SILENTLY against the
-- table-level grant.
select relacl from pg_class where relname = 'profiles' and relnamespace = 'public'::regnamespace;

-- MUST list exactly id, full_name, avatar_url, phone for authenticated:
select column_name, privilege_type from information_schema.column_privileges
 where table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE'
 order by column_name;
```

```bash
# As a signed-in non-operator customer. MUST return 401/403, not 200.
curl -i -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$MY_UID" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"plan":"business"}'
```

App smoke: `/settings` → change the display name → saves without error (this is the upsert at `lib/auth/actions.ts:269-271`, the reason `id` is in the re-grant list).

### 9.2 After step 2 — the two guards

```bash
# MUST all 42501 / 403:
curl -X PATCH "$SUPABASE_URL/rest/v1/businesses?id=eq.$MY_BIZ" -H "apikey: $ANON" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" -d '{"site_mode":"store"}'

curl -X PATCH "$SUPABASE_URL/rest/v1/websites?business_id=eq.$MY_BIZ" -H "apikey: $ANON" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" -d '{"published":true}'

# The DELETE-then-INSERT bypass — MUST be refused at the DELETE:
curl -X DELETE "$SUPABASE_URL/rest/v1/websites?business_id=eq.$MY_BIZ" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT"

# And a fresh INSERT with published:true — MUST 42501:
curl -X POST "$SUPABASE_URL/rest/v1/websites" -H "apikey: $ANON" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{"business_id":"'"$MY_BIZ"'","slug":"pwn-test","published":true}'
```

```sql
-- Enumerate the documented loophole: postgres-owned SECURITY DEFINER functions
-- granted to `authenticated`. NONE may write businesses.site_mode or
-- websites.published. Today only next_invoice_number qualifies.
select p.proname, pg_get_userbyid(p.proowner) as owner, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.prosecdef
   and array_to_string(p.proacl,',') like '%authenticated=X%';
```

App smoke, **both branches**: `/businesses/[id]/website` → publish a site → succeeds and the slug appears; unpublish → succeeds; re-publish with a slug already taken by another business → the Hebrew `הכתובת הזו כבר תפוסה` still appears (proves the 23505 translation survived the service-role move). Then run the wizard end to end and confirm a new business is still created with its package's `site_mode`.

`npm test` — `tests/site-mode.test.ts` and `tests/plans.test.ts:108-110` pin `SITE_MODES` order and each tier's `siteModes`; they must stay green.

### 9.3 After step 3 — the schema

```sql
select to_regclass('public.platform_admins'), to_regclass('public.platform_grants'),
       to_regclass('public.admin_audit_log');

-- MUST be non-zero, or /admin is unreachable:
select count(*) from public.platform_admins where disabled_at is null;

-- Default privileges are invisible in the migration text. MUST show NO
-- anon/authenticated entries, and service_role with SELECT only:
select relname, relacl from pg_class
 where relname in ('platform_admins','platform_grants','admin_audit_log');

-- ALL definer functions MUST show no PUBLIC (`=X/`), no anon, no service_role:
select proname, proacl from pg_proc
 where proname in ('is_platform_admin','platform_admin_self','admin_grant',
                   'admin_revoke_grant','admin_set_site_mode','admin_set_module_config',
                   'admin_set_layout_style','admin_unstick_job','admin_clear_burst_limit',
                   'admin_note');

-- Append-only, both triggers:
insert into public.admin_audit_log (actor_user_id, action, reason)
 values ('9d1bba47-ad47-440f-a683-89db23360f27','test.verify','verification row');
update public.admin_audit_log set reason='x' where action='test.verify';  -- MUST raise 42501
delete from public.admin_audit_log where action='test.verify';            -- MUST raise 42501
truncate public.admin_audit_log;                                          -- MUST raise 42501
```

```bash
# Anonymous + authenticated MUST both be refused on every admin RPC:
curl -X POST "$SUPABASE_URL/rest/v1/rpc/admin_grant" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"p_user":"'"$MY_UID"'","p_business":null,"p_kind":"plan_tier","p_amount":null,"p_plan":"business","p_expires":null,"p_reason":"pwn attempt"}'

curl -X POST "$SUPABASE_URL/rest/v1/rpc/admin_grant" -H "apikey: $ANON" \
  -H "Authorization: Bearer $NON_OPERATOR_JWT" -H "Content-Type: application/json" -d '{...same...}'
# MUST return 'not a platform operator' (42501), NOT a grant id.

# And with the SERVICE key — MUST be "permission denied for function admin_grant":
curl -X POST "$SUPABASE_URL/rest/v1/rpc/admin_grant" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" -d '{...same...}'
```

### 9.4 After step 4/5 — the gate

- Logged out → `GET /admin` → redirected to `/login?redirectedFrom=/admin` (proxy).
- Logged in as a **non-operator** → `GET /admin` → **404**, not a redirect and not a 403 (non-disclosure).
- Logged in as the operator, aal1, after step 5 flips `require_mfa` → **404**. Complete the TOTP challenge → **200**.
- `update platform_admins set disabled_at = now()` → operator reload → **404** with no deploy. Set back to null → 200.

### 9.5 After step 6 — the board

```sql
-- The board must show these exact populations, or a classifier is wrong:
select status, count(*) from public.jobs group by 1;                     -- expect 11 failed, 1 running
select count(*) from public.jobs where status='running'
   and updated_at < now() - interval '30 minutes';                       -- expect >= 1
select status, count(*) from public.email_log group by 1;                -- expect 9 failed
select status, count(*) from public.agent_logs group by 1;               -- expect 29 failed
select count(*) from public.businesses where status='generating';        -- expect 1
select coalesce(max(brief_date)::text,'never') from public.daily_briefs; -- cron heartbeat
explain (costs off) select * from public.jobs
 where status in ('queued','running','failed') order by updated_at desc limit 50;
 -- MUST use idx_jobs_unhealthy
```

Manual: open `/admin` and confirm every count above appears, that the Anthropic failures are collapsed and tagged `ספק לא פעיל`, that no `select('*')` on `orders`/`crm_leads`/`customer_profiles` appears in the network trace, and that the page body does not scroll horizontally at 375px.

### 9.6 After step 7 — grants

```
npm test        # tests/grants.test.ts + tests/addons.test.ts must both pass
```

Then, end to end on a real test user:
1. `/admin/customers/[userId]` → grant `+50 יצירות` with a reason.
2. `select * from public.platform_grants where user_id = '<uid>' and revoked_at is null;` → exactly one row, `expires_at` = the 1st of next month UTC.
3. `select action, reason, after from public.admin_audit_log order by created_at desc limit 1;` → `grant.ai_generations`, the reason, the effective before/after.
4. That user's `/settings` → the AI row reads `… + 50 מתנה` and the limit is 250 for a `pro` account.
5. **Submit the same form twice** → still exactly one live row; the first is `revoked_at` set with `superseded_by` pointing at the second. This is the check that proves `platform_grants_one_live_idx` + the supersede clause work.
6. `ביטול` → `revoked_at` set, `/settings` back to 200 on reload, a second audit row present.
7. Attempt 21 grants in 24h → the 21st raises `daily grant limit reached`.
8. Attempt a grant with a 3-character reason → refused by `platform_grants_shape`/`reason` CHECK before anything is written.

### 9.7 After step 10 — the store upgrade

On a **test** `website`-mode business owned by a test user:
1. Refusal path A: run it on a `landing` business → returns `needsRebuild`, writes nothing, and `admin_set_site_mode` independently raises if called directly.
2. Refusal path B: run without `confirmLiveCheckout` → refused, nothing written.
3. Happy path → then verify, in order:
   - `select site_mode from businesses where id=…` → `store`;
   - `select kind, plan, expires_at from platform_grants where user_id=… and revoked_at is null` → `plan_tier / business / null`;
   - `select module_config->'returns', module_config->'order_tracking' from businesses where id=…` → both `enabled: true`;
   - four audit rows: `store_upgrade.begin`, `grant.plan_tier`, `module_config.set`, `site_mode.upgrade`, `store_upgrade.complete`;
   - the owner's dashboard shows the חנות nav item and the store screen renders the product form (not `UpgradeGate`);
   - the owner can add a product and publish;
   - the returned checklist flags `0 מוצרים` and `layout_style: flow`;
   - `store_without_products` appears on the board.
4. **Idempotency:** run the identical action again → no duplicate grant, `admin_set_site_mode` returns `noop`, no error surfaced.
5. **Half-fail:** kill the request between steps 2 and 3 (throw in a temporary debug branch) → the board shows `half_finished_action` within 15 minutes and its Retry completes cleanly.
6. `curl -s "$APP_URL/sitemap.xml" | grep -c '/product/'` → non-zero within an hour.

### 9.8 After step 11 — the digest

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/operator-digest"   # 200 + JSON counts
curl -i "$APP_URL/api/cron/operator-digest"                                            # 401
```

```sql
select status, kind, error from public.email_log
 where kind='operator_digest' order by created_at desc limit 3;
select action, after->>'fingerprint' from public.admin_audit_log
 where action='digest.sent' order by created_at desc limit 3;
```

Run it twice with no fault change → the second run must **not** send a second email.