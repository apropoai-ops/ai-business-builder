-- 0086 — give products.sort_order a sane per-business sequence.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.
--
-- SHIPS WITH A CODE CHANGE (see §3). The code change is the actual fix; this
-- migration is data hygiene and is deliberately a no-op for rendered order.
--
-- ── The finding ─────────────────────────────────────────────────────────────
-- products.sort_order is `int not null default 0` (0012:17). Grep of app/,
-- lib/, components/ and scripts/ for a WRITE of sort_order returns exactly one
-- hit — scripts/seed-mode-demos.ts:219 — which is demo seeding. There is no
-- owner-facing reorder UI and no server action that sets it. So every product
-- a real customer creates lands on the default 0.
--
-- getPublicSiteBySlug (lib/services/website.service.ts) ordered by sort_order
-- ALONE and then took .limit(24). With ties, SQL leaves the order unspecified,
-- so both the order AND the membership of the rendered set were arbitrary.
--
-- ── Measured blast radius on prod (vxkamrcukzdovfikzeyt, 2026-08-04 ─────────
-- 9 published sites, 3 of which have any products, 17 product rows total:
--   /s/mode-fashion-demo    9 active   sort_order [0..8]  seeded, well-ordered
--   /s/grave-jewelry-demo   6 active   sort_order [0..5]  seeded, well-ordered
--   /s/tehc-hrb-demo        2 active   sort_order [0,0]   TIED  <-- the bug
-- The two clean stores are clean only because the seed script wrote them; the
-- one store with hand-added products is the degenerate case. No store is near
-- the 24 cap, so today only ordering was at risk, not membership.
--
-- ── What this does ──────────────────────────────────────────────────────────
-- Renumbers 0..n-1 per business, ordered by (sort_order, created_at, id) —
-- i.e. the SAME key the fixed query now sorts by. Existing intentional
-- sequences are therefore PRESERVED, ties are broken by age, and the rendered
-- order after this migration is byte-identical to the rendered order the code
-- change alone produces. That is the point: the data gets tidy without the
-- migration itself moving anything on screen.
--
-- Touches only businesses that actually have a duplicate sort_order, so the
-- two seeded stores above are not rewritten at all. Idempotent: after it runs,
-- no business has a duplicate, so a second run updates zero rows.
-- ────────────────────────────────────────────────────────────────────────────


-- ══ 1. The backfill ════════════════════════════════════════════════════════

with degenerate as (
  -- businesses where sort_order is not already a distinct sequence
  select business_id
  from public.products
  group by business_id
  having count(*) > count(distinct sort_order)
),
renumbered as (
  select
    p.id,
    row_number() over (
      partition by p.business_id
      order by p.sort_order, p.created_at, p.id
    ) - 1 as new_sort_order
  from public.products p
  join degenerate d on d.business_id = p.business_id
)
update public.products p
set sort_order = r.new_sort_order
from renumbered r
where r.id = p.id
  and p.sort_order is distinct from r.new_sort_order;


-- ══ 2. Verification ════════════════════════════════════════════════════════
-- Expect zero rows. Any row here means a business still has tied sort_order.
--   select business_id, count(*), count(distinct sort_order)
--   from public.products group by business_id
--   having count(*) > count(distinct sort_order);


-- ══ 3. CODE CHANGE THIS SHIPS WITH ═════════════════════════════════════════
--   lib/services/website.service.ts getPublicSiteBySlug — the public product
--   query gained .order("created_at").order("id") after .order("sort_order").
--   That is the durable fix; this migration only tidies existing rows.
--   lib/services/store.service.ts listProducts gained the matching .order("id")
--   so the owner's product list and the storefront are in the same order.
--
-- ── KNOWN GAP, deliberately not closed here ────────────────────────────────
-- Nothing still writes sort_order on INSERT, so every NEW product continues to
-- land on 0 and this table drifts back toward ties over time. The query-side
-- tiebreak means that is now cosmetic rather than a correctness bug — order
-- stays deterministic regardless. Assigning max(sort_order)+1 on insert, and
-- an owner-facing reorder UI, are a separate piece of work.


-- ── Down ────────────────────────────────────────────────────────────────────
-- Not reversible in any meaningful sense: the pre-migration values were
-- indistinguishable duplicates (all 0 within the affected business), so there
-- is nothing to restore to. To return the affected businesses to the old
-- degenerate state:
--   update public.products set sort_order = 0
--   where business_id = '67fd4210-6d19-4302-9e0c-39866c447fce';
-- REVERT THE CODE TOO if you do this, or order simply stays deterministic
-- (which is the desired end state anyway — there is no reason to revert).
