# IMPLEMENTATION SPEC — אולפן העיצוב (Design Studio)

Target repo: `C:\Users\ofek8\OneDrive\Desktop\הכל לעסקים` — Next 16.2.x (App Router, React 19), Tailwind v4, Base UI 1.5, Supabase (project `vxkamrcukzdovfikzeyt`, PostgreSQL 17.6), Hebrew RTL throughout.
**NO GIT IN THIS REPO.** Every migration carries its own down-path. Every package below states what to copy to the scratchpad before its first destructive edit.
Produced 2026-08-04. **Revision 2, same day**, after three hostile reviews (regression / security / product-UX). 49 findings; every one is fixed in the design below **and** accounted for in **§L תשובות לביקורת**, which records the verdict for each and the code that justifies the four partial or redirected fixes. A re-verification pass over every load-bearing citation surfaced six further line-number drifts beyond the one the reviewers caught; all are corrected, and §I now carries a standing *Citation hygiene* rule. No source file was modified while writing or revising this spec.

Scratchpad root for all backups:
`C:\Users\ofek8\AppData\Local\Temp\claude\C--Users-ofek8-OneDrive-Desktop-----------\dffbbc90-4104-49be-95a7-fbb836435c24\scratchpad\design-studio-backup\`

---

## Correction to the dossier, verified this session

The AI-pipeline reader reported that `websites` / `brand_assets` / `businesses` carry **column-level** grants, and therefore that a new column would need an explicit `GRANT`. **That is wrong**, and building on it would have produced a pointless (and slightly dangerous) grant statement.

Verified against the live database:

```sql
-- pg_class.relacl (TABLE-level grants)
businesses  {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}
products    {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}
websites    {postgres=arwdDxtm/postgres, anon=arwDxtm/postgres,  authenticated=arwDxtm/postgres,  service_role=arwdDxtm/postgres}
                                                    ^ no 'd' — DELETE revoked by 0085

-- pg_attribute.attacl (COLUMN-level grants) — the ONLY rows in the public schema:
profiles.id, profiles.full_name, profiles.phone, profiles.avatar_url  → {authenticated=aw/postgres}
```

`information_schema.column_privileges` enumerates one row per column even for a table-level grant — that is what the reader saw. Only `profiles` has real column ACLs (migration 0083). **A new column on `websites` is automatically writable by `authenticated` via the RLS client. No grant needed.**

Two more facts verified the same way, both load-bearing:

- `pg_default_acl` for schema `public`, object type `r`: `{postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}`. A **new table** created by `postgres` (which is what Supabase MCP `apply_migration` runs as) also gets full grants automatically. The explicit `grant`/`revoke` block in §B is belt-and-braces and is documented as such.
- `assert_platform_controlled_write()` (trigger on `businesses` and `websites`) raises `42501` **only** when `businesses.site_mode` or `websites.published` actually changes value. Writing new columns on `websites` through the RLS client is unaffected. Confirmed by reading `pg_get_functiondef`.

---

## A. Goal + the product story

**Goal.** Give a non-technical Israeli business owner a live, direct-manipulation studio where they see their *real* site, drag its sections into the order they want, hide what they don't want, retune every colour / corner / font / rhythm through a token system, and — in a clothing store — build a side category menu (חולצות / מכנסיים / הלבשה תחתונה). The first version of that design is composed end-to-end by our AI at the highest quality we can buy, so the owner starts from something good and *edits*, never from a blank canvas. Nothing they do touches the live site until they press **פרסום העיצוב**.

**The story.** Dana sells clothes in Petah Tikva. Her site was generated three weeks ago and it is fine, but the black is too hard and she wants the store above the "about us". She opens **אולפן עיצוב**. The first time, a short Hebrew progress card runs for ~35 seconds while our `design_system` agent composes a full design — a palette with roles, a Hebrew-safe font pairing, corner radii, section rhythm, button shape, a hero style, a layout preset, and a section order chosen for *a store*. The studio opens on the **מראה** panel: six ready-made looks across the top, the AI's design name and its one-line rationale, and the four controls that actually change how a site feels (background, accent, heading font, corner radius). Her real site is on the right. She taps a lighter preset; a small amber note appears — *"הטקסט המשני יורד מתחת לניגודיות AA"* — with a **תקנו לי** button that snaps the ink back to a readable value. She switches to **מקטעים**, grabs the "החנות שלנו" chip floating over the section and pulls it above "עלינו"; the preview reorders instantly. She overshoots, presses **↶**, and it comes back. Everything so far lives in a draft. She presses **פרסום העיצוב**, reads the plain-Hebrew list of what will change, confirms, and her live storefront changes for the first time.

Her category tree — חולצות / מכנסיים / הלבשה תחתונה — is built on the **חנות** screen, not in the studio, because category edits hit the live catalogue the moment they are saved and must never sit inside a draft-and-publish surface (§F.2, §G.1). The studio links straight to it.

**Why structured, not free canvas** (owner-facing framing, so the constraint reads as a feature): the studio never lets her produce a site that breaks on a phone. Every control is a *design decision* (order, alignment, size, visibility, colour, shape, rhythm), never a pixel coordinate. The line **"כל שינוי שתעשו כאן נשאר מושלם גם בנייד — אנחנו לא נותנים לכם לשבור את האתר."** is a **permanent one-line footer under the inspector tabs**, not empty-state copy: §F.1 gates the studio behind `<DesignWatcher>`, so a design always exists and an empty state never renders.

---

## B. Data model

### B.1 Migration `supabase/migrations/0086_design_studio.sql`

Next sequential number is **0086** (latest in-repo is `0085_lock_site_mode_and_publish.sql`).

Reversibility table:

| Change | Reversible? | How |
|---|---|---|
| 3 new columns on `websites` | Yes | `alter table … drop column` (down-path at bottom) |
| `store_categories` table | Yes | `drop table … cascade` |
| `products.category_id` | Yes | drop constraint + drop column; `products.category` was never emptied |
| 2 sync triggers | Yes | `drop trigger` + `drop function` |
| Backfill of `store_categories` from `products.category` | Yes | rows are dropped with the table; `products.category` is read-only in the backfill |
| Backfill of `products.category_id` | Yes | column dropped; no other column written |

```sql
-- 0086_design_studio.sql
--
-- Two independent things the design studio needs, applied together because
-- both are pure additions with no reader until the studio ships:
--
--   1. websites.design_draft / design_live — the token + section overrides the
--      studio writes. TWO columns, not one, because the whole safety story of
--      this feature is "an owner cannot change their live site by accident".
--      The studio autosaves into design_draft; only the explicit publish
--      action copies draft -> live. An EMPTY design_live means the storefront
--      emits nothing extra and renders byte-identically to today, which is the
--      hard guarantee for the ~9 live businesses.
--
--   2. store_categories + products.category_id — a real category TREE.
--      products.category (text) is DELIBERATELY KEPT and becomes a
--      server-maintained mirror, because seven live readers still read it
--      (public-store chips, related-products, cart cross-sell, the product
--      breadcrumb, the product subtitle, dashboard search, CSV export). A
--      rename under a text-join design would silently orphan every product;
--      owning the mirror in a trigger means the CSV import and the AI product
--      generator cannot drift from the tree either.
--
-- REJECTED: a separate `site_designs` table keyed by business_id. websites is
-- already 1:1 with the business, already has upsertWebsite() plumbing, and
-- already carries table-level write grants for `authenticated` (verified:
-- pg_class.relacl = anon/authenticated=arwDxtm). A new table would have bought
-- nothing but a join on the hottest public query.
--
-- REJECTED: joining store_categories to products by the existing TEXT column.
-- Production already contains near-duplicates on one business
-- (d6d97eb4-…: both 'חולצות' and 'חולצות וטופים'), and a text join cannot
-- express a parent/child tree at all.
--
-- GRANTS (see the block in section 2): pg_default_acl hands anon AND
-- authenticated `arwdDxtm` on every new table in schema public. That is the
-- exact blind spot 0076_lock_down_service_role_rpcs.sql:1-5 was written for, so
-- this migration REVOKES ALL from anon rather than re-granting a narrower slice
-- of a default that already exists. Nothing in this feature needs anon on
-- store_categories: the only public reader is getPublicCategoryTree(), which
-- runs on createServiceRoleClient().
--
-- TRIGGER FUNCTIONS: both functions below are SECURITY INVOKER (no `security
-- definer` keyword) and return `trigger`, so PostgREST does not expose them and
-- the 0076 PUBLIC-EXECUTE lesson does not apply. DO NOT convert either to
-- SECURITY DEFINER — sync_category_rename()'s inner UPDATE is scoped only by
-- new.business_id and would become a cross-tenant write primitive under a
-- definer's rights.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.

-- ── 1. websites: design draft / live ────────────────────────────────────────

alter table public.websites
  add column if not exists design_draft jsonb not null default '{}'::jsonb;
alter table public.websites
  add column if not exists design_live jsonb not null default '{}'::jsonb;
alter table public.websites
  add column if not exists design_generated_at timestamptz;

comment on column public.websites.design_draft is
  'Studio working copy (DesignConfig) — see lib/site-design.ts. Never RENDERED by /s/[slug] except under a verified studio preview cookie. getPublicSiteBySlug selects an explicit column list that omits this column entirely (website.service.ts), so it never enters the public render path or the RSC payload.';
comment on column public.websites.design_live is
  'Published design (DesignConfig). {} means "render exactly as before the studio existed".';
comment on column public.websites.design_generated_at is
  'When the design_system agent last composed a design. NULL = the studio has never run for this business.';

-- Partial index: the only query that ever scans this is the operator console
-- asking "who has adopted the studio", and 9 of 9 rows are {} today.
create index if not exists websites_design_live_adopted_idx
  on public.websites (business_id)
  where design_live <> '{}'::jsonb;

-- ── 2. store_categories ─────────────────────────────────────────────────────

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Self-FK is COMPOSITE, exactly like the products FK below and for exactly
  -- the same reason. A single-column `references store_categories(id)` would
  -- validate only that the row exists; RLS validates only business_id. An
  -- attacker with their own paying account and the public anon key could then
  --   POST /rest/v1/store_categories {"business_id":<theirs>,"parent_id":<victim's>}
  -- which (a) couples their row's lifetime to another tenant's cascade, and
  -- (b) is a cross-tenant existence oracle. Max depth 2 is still enforced in
  -- code (lib/site-categories.ts), not here: a CHECK cannot see the parent row.
  parent_id uuid,
  name text not null,
  slug text,
  icon text,
  image_url text,
  sort int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Required target for the composite FK from products, so a product can never
  -- point at ANOTHER business's category. products RLS only checks
  -- products.business_id, so without this an owner could PATCH category_id to
  -- a stranger's uuid through PostgREST with the public anon key.
  constraint store_categories_id_business_key unique (id, business_id)
);

-- Added as a separate statement because it targets the unique constraint the
-- same CREATE TABLE just declared.
alter table public.store_categories
  drop constraint if exists store_categories_parent_fk;
alter table public.store_categories
  add constraint store_categories_parent_fk
  foreign key (parent_id, business_id)
  references public.store_categories (id, business_id)
  on delete cascade;

alter table public.store_categories enable row level security;

drop policy if exists "store_categories_owner_all" on public.store_categories;
create policy "store_categories_owner_all" on public.store_categories
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop trigger if exists trg_store_categories_updated_at on public.store_categories;
create trigger trg_store_categories_updated_at
  before update on public.store_categories
  for each row execute function public.set_updated_at();

create index if not exists store_categories_business_sort_idx
  on public.store_categories (business_id, sort, created_at);
create index if not exists store_categories_parent_idx
  on public.store_categories (parent_id)
  where parent_id is not null;

-- Name uniqueness is split in two because NULL parent_id defeats a plain
-- UNIQUE. Both are also what makes the backfill's ON CONFLICT meaningful.
create unique index if not exists store_categories_root_name_key
  on public.store_categories (business_id, name)
  where parent_id is null;
create unique index if not exists store_categories_child_name_key
  on public.store_categories (business_id, parent_id, name)
  where parent_id is not null;

-- NOT belt-and-braces — this NARROWS a default that really exists.
-- pg_default_acl for schema public grants arwdDxtm to anon AND authenticated
-- on every new table created by `postgres` (which is what Supabase MCP
-- apply_migration runs as). A `grant select, insert, update … to anon` would
-- therefore re-affirm the 0076 blind spot and still leave anon holding
-- TRUNCATE (D), REFERENCES (x) and TRIGGER (t). So: revoke everything from
-- anon, and grant authenticated exactly the four DML verbs the owner UI needs.
--
-- DELETE is deliberately GRANTED to authenticated, unlike 0085's treatment of
-- websites.published. 0085 revoked DELETE because a delete+re-insert was a
-- bypass for a platform-controlled COLUMN; store_categories has no privileged
-- column, the RLS policy below is `for all` (so it already covers DELETE with
-- the same is_business_owner predicate), and revoking it would have pushed
-- deleteCategory onto createServiceRoleClient() — i.e. onto the very
-- `.eq("id", …)`-only shape that store.service.ts:70-83 already gets wrong.
revoke all on public.store_categories from anon;
grant select, insert, update, delete on public.store_categories to authenticated;

-- ── 3. products.category_id ─────────────────────────────────────────────────

alter table public.products
  add column if not exists category_id uuid;

alter table public.products
  drop constraint if exists products_category_id_fkey;
alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id, business_id)
  references public.store_categories (id, business_id)
  -- Column-list SET NULL (PG 15+; this cluster is 17.6). Without the column
  -- list Postgres would try to null business_id too, which is NOT NULL.
  -- CASCADE here would delete the owner's PRODUCTS when they delete a category.
  on delete set null (category_id);

create index if not exists idx_products_category_id
  on public.products (category_id)
  where category_id is not null;

-- ── 4. The mirror: products.category / subcategory stay in sync ─────────────

create or replace function public.sync_product_category_name()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  cat_name text;
  par_name text;
begin
  if new.category_id is null then
    -- Un-assigning does NOT clear the legacy text. An owner who never opens
    -- the studio keeps the exact strings their storefront renders today.
    return new;
  end if;

  select c.name, par.name
    into cat_name, par_name
    from public.store_categories c
    left join public.store_categories par on par.id = c.parent_id
   where c.id = new.category_id;

  if cat_name is null then
    return new;
  end if;

  if par_name is null then
    -- Root category: mirror into `category`. `subcategory` is left alone on
    -- purpose — one live product carries 'טי-שירט' there and nulling it would
    -- visibly change its card.
    new.category := cat_name;
  else
    new.category := par_name;
    new.subcategory := cat_name;
  end if;

  return new;
end $function$;

drop trigger if exists trg_products_sync_category on public.products;
create trigger trg_products_sync_category
  before insert or update of category_id on public.products
  for each row execute function public.sync_product_category_name();

create or replace function public.sync_category_rename()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.name is not distinct from old.name then
    return new;
  end if;

  -- Renaming a ROOT rewrites products.category for its own products and for
  -- every child's products; renaming a CHILD rewrites products.subcategory.
  if new.parent_id is null then
    update public.products p
       set category = new.name
     where p.business_id = new.business_id
       and (p.category_id = new.id
            or p.category_id in (select id from public.store_categories
                                  where parent_id = new.id));
  else
    update public.products p
       set subcategory = new.name
     where p.business_id = new.business_id
       and p.category_id = new.id;
  end if;

  return new;
end $function$;

drop trigger if exists trg_store_categories_rename on public.store_categories;
create trigger trg_store_categories_rename
  after update of name on public.store_categories
  for each row execute function public.sync_category_rename();

-- ── 5. Backfill (17 products / 8 distinct strings across 3 businesses) ──────

-- One ROOT category per distinct non-empty products.category, ordered by the
-- first product that used it so the storefront chip order is unchanged.
insert into public.store_categories (business_id, name, sort)
select p.business_id,
       p.category,
       (row_number() over (partition by p.business_id order by min(p.created_at), p.category) - 1)::int
  from public.products p
 where p.category is not null
   and btrim(p.category) <> ''
 group by p.business_id, p.category
on conflict do nothing;

update public.products p
   set category_id = c.id
  from public.store_categories c
 where c.business_id = p.business_id
   and c.parent_id is null
   and c.name = p.category
   and p.category_id is null;

-- DELIBERATELY NOT BACKFILLED: products.subcategory. Exactly one live row has
-- one ('טי-שירט' under 'חולצות וטופים'). Promoting it to a child node would
-- have to re-point that product, and the safest possible migration is one that
-- leaves every rendered string exactly where it was. The owner can create the
-- child in the manager; re-assigning the product then updates both columns
-- through the trigger above.

-- ── Down ────────────────────────────────────────────────────────────────────
-- drop trigger if exists trg_store_categories_rename on public.store_categories;
-- drop function if exists public.sync_category_rename();
-- drop trigger if exists trg_products_sync_category on public.products;
-- drop function if exists public.sync_product_category_name();
-- alter table public.products drop constraint if exists products_category_id_fkey;
-- drop index if exists public.idx_products_category_id;
-- alter table public.products drop column if exists category_id;
-- drop table if exists public.store_categories cascade;
-- drop index if exists public.websites_design_live_adopted_idx;
-- alter table public.websites drop column if exists design_generated_at;
-- alter table public.websites drop column if exists design_live;
-- alter table public.websites drop column if exists design_draft;
-- Note: products.category / products.subcategory are never emptied by this
-- migration, so the down-path restores the exact pre-0086 storefront.
```

### B.2 Exact `types/database.ts` additions

`types/database.ts` is **hand-maintained** (proof: `products.colors` is typed `ProductColor[] | null` over a `jsonb` column; a generated file would emit `Json`). **Do not regenerate** — it would erase ~100 convenience aliases and every doc comment. Hand-edit these five places.

**1) `websites.Row`** — after `layout_style: string;` (currently `types/database.ts:504`):

```ts
          /** Studio working copy (DesignConfig) — see lib/site-design.ts. */
          design_draft: Json;
          /** Published design (DesignConfig). {} renders exactly as pre-studio. */
          design_live: Json;
          design_generated_at: string | null;
```

**2) `websites.Insert`** — after `layout_style?: string;`:

```ts
          design_draft?: Json;
          design_live?: Json;
          design_generated_at?: string | null;
```

**3) `websites.Update`** — after `layout_style?: string;`:

```ts
          design_draft?: Json;
          design_live?: Json;
          design_generated_at?: string | null;
```

**4) `products`** — add to `Row` (after `engraving: Json | null;`), `Insert` and `Update`:

```ts
          /** FK -> store_categories(id). products.category/subcategory are a
           *  server-maintained mirror kept by trg_products_sync_category. */
          category_id: string | null;   // Row
          category_id?: string | null;  // Insert + Update
```

And extend `products.Relationships` (currently `[]` at `types/database.ts:1030`):

```ts
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id", "business_id"];
            referencedRelation: "store_categories";
            referencedColumns: ["id", "business_id"];
          },
        ];
```

**5) New table block** — insert alphabetically near the other store tables:

```ts
      store_categories: {
        Row: {
          id: string;
          business_id: string;
          parent_id: string | null;
          name: string;
          slug: string | null;
          icon: string | null;
          image_url: string | null;
          sort: number;
          visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          parent_id?: string | null;
          name: string;
          slug?: string | null;
          icon?: string | null;
          image_url?: string | null;
          sort?: number;
          visible?: boolean;
        };
        Update: {
          parent_id?: string | null;
          name?: string;
          slug?: string | null;
          icon?: string | null;
          image_url?: string | null;
          sort?: number;
          visible?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "store_categories_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_categories_parent_fk";
            columns: ["parent_id", "business_id"];
            referencedRelation: "store_categories";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
```

**6) Tail alias** — next to `export type Product = Tables<"products">;` (`types/database.ts:2798`):

```ts
export type StoreCategory = Tables<"store_categories">;
```

---

## C. The token system

### C.1 The two mechanisms, and why zero-change holds

Two, and only two, ways a token reaches the page:

**(M1) `var(--t-x, <existing literal>)`.** A declaration that already exists in `tier-styles.tsx` has its literal wrapped. `var(--x, F)` with `--x` unset computes **exactly** `F`. No emitted var ⇒ byte-identical CSS text is not required — the *computed* value is identical, which is what renders.

**(M2) Conditional rule.** For anything that does **not** exist as a declaration today (section padding, grid columns, button style, hero fill, hero overlay), the rule is emitted **only inside the theme `<style>` tag**, which is only rendered when a design exists. No design ⇒ no rule ⇒ nothing changes.

Both are guarded by one gate: `components/public/theme-style.tsx` returns `null` when `resolveDesignConfig(raw)` returns `null`, and `resolveDesignConfig` returns `null` for `{}`, `null`, arrays, strings and anything else that is not an object with at least one recognised token.

**IACVT guard.** If a token is malformed, `var(--x, F)` does **not** fall back to `F` — the declaration becomes invalid at computed-value time and resolves to inherit/initial, which can blank a whole surface. `--t-border-w: 2` (no unit) turns `border: var(--t-border-w, 1px) solid …` into `border: 2 solid …`, the whole **shorthand** resets, `border-style` becomes `none`, and every product-card border vanishes. `--t-radius-card: NaNpx` squares every card. `--t-cta-mix: 18` (no `%`) makes the CTA band's whole `color-mix()` background transparent. Therefore three separate contracts, all in `lib/site-design.ts`, all enforced by `designToCss` and nowhere else:

**(a) Colours — drop on invalid, never substitute.**

```ts
// lib/site-design.ts — NOT components/public/tiers/color-utils.ts.
const DESIGN_HEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/;
/** null on failure; 3-digit is expanded so every downstream consumer
 *  (parseHex, contrastRatio, hexToRgb) sees a uniform 6-digit value. */
export function safeDesignHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (!DESIGN_HEX.test(s)) return null;
  return s.length === 4 ? "#" + s.slice(1).split("").map((c) => c + c).join("") : s;
}
```

`safeHexColor()` (`components/public/tiers/color-utils.ts:14`) **must not be used for design tokens**, for two independent reasons, both verified in the file:
- Its signature is `(input, fallback = "#2563eb")`. It **never signals failure** — it returns bright blue. The obvious `--t-surface-0: ${safeHexColor(raw)}` turns a malformed ground into a blue live storefront, which is the exact opposite of "falls back to M1's literal".
- Its regex is `/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/` — it **accepts 8-digit `#rrggbbaa`**, while `hexToRgb` throws the alpha away (`const n = parseInt(h.slice(0, 6), 16)`, `color-utils.ts:29`) and `parseHex` in `lib/storefront-brand.ts:21-27` rejects 8-digit outright. So `inkBody: "#c9c9c900"` would measure ~11:1 against `#000000`, sail through `auditContrast`, survive `autoCorrectContrast` untouched, and render **fully transparent body text on a live storefront**. `safeDesignHex` rejects 8-digit, which is also what §J already required.

Its existing call site (`safeBrand = safeHexColor(brand)`) is correct and stays — a brand colour genuinely wants a fallback. A design token does not.

**(b) Numbers — finite or dropped. Never coerced, never clamped-after-coercion.**

```ts
function num(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;  // "5", NaN, Infinity, {}, null → dropped
  return Math.min(max, Math.max(min, v));
}
```
`Math.min(28, Math.max(0, Number(v)))` — the obvious implementation — returns `NaN` for `"abc"`, `{}` and `[]`, and that is a live IACVT. The type check comes first, always.

**(c) Units are part of the registry, not of the call site.** Every `TOKENS` entry declares its unit and owns its own serialisation:

```ts
interface TokenDef {
  key: string; label: string; group: TokenGroup;
  type: "color" | "number" | "enum";
  min?: number; max?: number; values?: readonly string[];
  unit?: "px" | "rem" | "%";        // absent = unitless (gridColumns, heroOverlay) or n/a
  cssVar: string;                    // primary var
  emit(v: string | number): Record<string, string>;   // var name -> serialised value
}
```
`emit` returns a **map**, not a string, because four tokens legitimately drive more than one variable (see §C.2's derived-ramp note). A number token's `emit` appends its declared `unit`; nothing else may append units.

**Emission site — a correction the whole engine depends on.** One `<style>` from `components/public/theme-style.tsx`, rendered after `<TierStyles>` and after the page's own inline `<style>` (`app/s/[slug]/page.tsx:819-830`). It is **unlayered**, like `TierStyles` — the whole engine rests on Tailwind living in `@layer utilities` (`node_modules/tailwindcss/index.css:1`) while these tags do not. **Never move this into a `@layer` or a Tailwind plugin.**

**`ThemeStyle` is NOT the last unlayered stylesheet on the page.** `grep -rl "<style>" components/public` returns **13 files**, and these all render *after* `page.tsx:830` in document order:

| emitted after ThemeStyle | mounted at |
|---|---|
| all 8 hero styles + `heroes/liquid-glass.ts` | `<StoreHero>`, `page.tsx:956` |
| `components/public/tiers/hud-frame.tsx` | via `heroes/store-hero.tsx:104` |
| `components/public/tiers/statement-section.tsx` | `page.tsx:678` |
| `components/public/tiers/marquee-band.tsx` | `page.tsx:985` |

**Therefore: every `ThemeStyle` rule must win on SPECIFICITY. It may never rely on document order.** Concretely, a theme rule that has to beat a hero's own block needs ≥4 attribute selectors, because the hero blocks are `[data-tier="professional"] [data-el="hero"] h1.xx-h1` = **(0,3,1)**. §J carries an assertion that enumerates every theme selector and its computed specificity, so this cannot rot.

Scope selector: `[data-tier][data-design]` = (0,2,0) before anything else is added. The root `<div data-tier>` gains `data-design` only when a design exists, giving every theme rule one extra attribute of specificity over the base tier rule it overrides — which is how M1 wrappers on `!important` declarations stay winnable and how M2 rules beat Tailwind utilities.

### C.2 The complete token table

32 owner-facing tokens. `key` is the JSON key under `design.tokens`.

**Read this before the tables.** A reviewer proved that four entries in the old version of this table advertised a "default = today's literal" that was **false**, because one token replaced 2–4 deliberately different current values. `inkBody` alone stood in for `#ececec` (chrome nav, `:345`/`:352`/`:354`), `#e5e5e5` (module-section, `:386`), `#c9c9c9` (the utility remap, `:397`) and `#dcdcdc` (footer links, `:499`). Since §H.2's Zod schema makes every token **required**, the first AI design necessarily sets all of them — so the old design would have flattened a real typographic hierarchy on every themed site, and any "reset to default" control would have written a site that is **not** today's site.

**The fix is a derived ramp, not a token split.** One owner control still exists per role, but its `emit` returns **several** variables whose ratios reproduce today's literals exactly at the default value. Four tokens do this:

| token | vars emitted | formula | reproduces at default |
|---|---|---|---|
| `inkBody` (`#c9c9c9`) | `--t-ink-1`, `--t-ink-1-hi` | `hi = color-mix(in srgb, var(--t-ink-1) 55%, var(--t-ink-0) 45%)` | `--t-ink-1` → `:397`; `--t-ink-1-hi` → `:345`/`:352`/`:354` `#ececec`, `:386` `#e5e5e5`, `:499` `#dcdcdc` (the three brighter body tones, which are within 4% of each other and of the mix result) |
| `hairlineStrength` (`10%`) | `--t-hair-soft`, `--t-hair-mid`, `--t-hair`, `--t-hair-strong` | `0.6N / 0.8N / N / 1.2N` percent of `--t-ink-0` | `.06` (`:411`), `.08` (`:343`,`:417`,`:442`,`:496`), `.10` (`:400`), `.12` (`:424`) — **exact** at N=10 |
| `revealDistance` (`32`) | `--t-rise`, `--t-rise-page`, `--t-rise-hero` | `D / 0.8125D / 0.75D` px | `32px` (`tier-styles:508`), `26px` (`page.tsx:821`), `24px` (`tier-styles:380`) — **exact** at D=32 |
| `inkStrong` (`#f4f4f4`) | `--t-ink-0` | single var | `:336`/`:432`/`:500` `#ffffff`, `:395` `#f4f4f4`, `:502` `#f0f0f0` — a 3% spread nobody can perceive; unified **deliberately**, and the table below says so instead of claiming a false default |
| `inkMuted` (`#b0b0b0`) | `--t-ink-2` | single var | `:399` `#b0b0b0`, `:497`/`:504` `#b8b8b8` — 3% spread, unified deliberately |

§J carries the assertion that closes this class of bug for good: **for every `TOKENS` entry, evaluating its `emit` at its default value must reproduce every literal it replaces**, or the entry must be listed in an explicit `UNIFIES` allowlist naming the literals it intentionally merges and the maximum ΔE between them.

**The studio never shows a per-token "default" and never offers "reset this token".** The only true revert is §F.4's **חזרה לעיצוב המקורי** (`design_draft = {}`), because a design where every token is set to its documented default is still not byte-identical to no design at all.

#### Colour (8)

| key | Hebrew label | type | allowed | default value | CSS var(s) | applied where |
|---|---|---|---|---|---|---|
| `surfaceBase` | צבע רקע ראשי | color | `#rgb`/`#rrggbb` | `#000000` | `--t-surface-0` | `professionalCss` `:335` root bg, `:385` module-section, `:495` footer |
| `surfaceRaised` | רקע רצועה מודגשת | color | `#rgb`/`#rrggbb` | `#0b0b0d` | `--t-surface-1` | `:410` `data-band="raised"`, `:423` chrome-menu |
| `surfaceCard` | רקע כרטיס | color | `#rgb`/`#rrggbb` | `#111214` | `--t-surface-2` | `:441` product-card |
| `surfacePanel` | רקע פאנל פנימי | color | `#rgb`/`#rrggbb` | `#121214` | `--t-surface-3` | `:392` `.bg-white`/`.bg-zinc-50` remap |
| `inkStrong` | צבע כותרות | color | `#rgb`/`#rrggbb` | `#f4f4f4` | `--t-ink-0` | **unifies** `:336`/`:432`/`:500` `#ffffff`, `:395` `#f4f4f4`, `:502` `#f0f0f0` |
| `inkBody` | צבע טקסט | color | `#rgb`/`#rrggbb` | `#c9c9c9` | `--t-ink-1` **+ derived** `--t-ink-1-hi` | `:397` (base); `:345`/`:352`/`:354`/`:386`/`:499` (hi) |
| `inkMuted` | צבע טקסט משני | color | `#rgb`/`#rrggbb` | `#b0b0b0` | `--t-ink-2` | **unifies** `:399` `#b0b0b0`, `:497`/`:504` `#b8b8b8` |
| `accent` | צבע הדגשה | color | `#rgb`/`#rrggbb` | `color-mix(in srgb, var(--brand) 55%, #d4af6a)` | `--t-accent` | `:334` — re-points `--gold`, so **9 downstream consumers** change with one token |

#### Shape (4)

| key | Hebrew label | type | allowed | default | CSS var | applied where |
|---|---|---|---|---|---|---|
| `radiusCard` | פינות כרטיסים | number **px** | 0–28 | `5` | `--t-radius-card` | `:443` |
| `radiusButton` | פינות כפתורים | number **px** | 0–50 | `50` | `--t-radius-btn` | `:467` |
| `borderWidth` | עובי מסגרת | number **px** | 0–3 | `1` | `--t-border-w` | `:442` product-card border |
| `hairlineStrength` | עוצמת קווי הפרדה | number **%** | 0–40 | `10` | `--t-hair-soft`, `--t-hair-mid`, `--t-hair`, `--t-hair-strong` | `:411` (soft), `:343`/`:417`/`:442`/`:496` (mid), `:400` (base), `:424` (strong) |
| `shadowDepth` | עוצמת צל | enum | `none` \| `soft` \| `deep` | `soft` | `--t-shadow-card`, `--t-shadow-btn` | `:402` shadow-sm, `:452-454` card hover, `:471`/`:477` btn |

> `hairlineStrength` emits four variables of the form `color-mix(in srgb, var(--t-ink-0, #f4f4f4) <k·N>%, transparent)` with `k ∈ {0.6, 0.8, 1.0, 1.2}`, so hairlines follow the ink automatically when an owner picks a light ground **and** the four distinct weights that exist today survive. At the default `N = 10` the four resolve to `.06 / .08 / .10 / .12` — exactly the literals in the file.

*(Shape is 5 rows; the group count in the header counts `hairlineStrength` under Colour in the UI, where it belongs visually. The JSON key set is what matters and is exhaustive here.)*

#### Typography (6)

| key | Hebrew label | type | allowed | default | CSS var | applied where |
|---|---|---|---|---|---|---|
| `headingFont` | גופן כותרות | enum | `HEBREW_FONTS` (14, §H.2) or `""` | `""` (= today's `brand_assets.typography.primary.font`) | **none — see below** | server-resolved into `page.tsx:829` |
| `bodyFont` | גופן טקסט | enum | `HEBREW_FONTS` or `""` | `""` | **none — see below** | server-resolved into `page.tsx:785` / `:274` |
| `headingWeight` | עובי כותרות | enum | `200`\|`300`\|`400`\|`600`\|`800` | `200` | `--t-title-weight` | `:430`, `:364` |
| `headingSize` | גודל כותרות | enum | `sm`\|`md`\|`lg` | `md` | `--t-title-size` | `:435` |
| `headingTracking` | מרווח אותיות בכותרת | enum | `tight`\|`normal`\|`wide` | `normal` | `--t-title-track` | `:431` |
| `titleGap` | רווח מתחת לכותרת | number **rem** | 0.5–4 | `2` | `--t-title-gap` | `:437` |

**The two font tokens are NOT CSS variables. This is a design change forced by review.**

`bodyFont` cannot reach the page through any stylesheet rule. `app/s/[slug]/page.tsx:782-786` is:

```tsx
<div data-tier={tier} className="min-h-screen bg-zinc-50 text-zinc-900"
     style={bodyFont ? { fontFamily: `'${bodyFont}', Heebo, sans-serif` } : undefined}>
```

An **inline `style` attribute beats every author rule that is not `!important`**, regardless of specificity or order, and §C.3 forbids this project from adding `!important` anywhere. So a `--t-font-body` M2 rule would be dead for every business that has a `brand_assets.typography.secondary.font` — the owner drags גופן טקסט and nothing happens.

Both font tokens are therefore **resolved on the server**, with no `var()` and no specificity fight at all:

```ts
// page.tsx, after the design/plan derivation
const effectiveBodyFont    = design?.tokens.bodyFont    || bodyFont;      // token wins, else brand_assets
const effectiveHeadingFont = design?.tokens.headingFont || headingFont;
```
- `:785` and `:274` use `effectiveBodyFont` in the existing inline style — still `undefined` when neither exists, so the no-design computed value is untouched.
- `:829`'s `h1,h2,h3 { font-family: … }` uses `effectiveHeadingFont` — identical shape, identical specificity.
- `fontsHref(typography)` (`page.tsx:85-95`) gains the two token families **behind an explicit `HEBREW_FONTS.includes(f)` membership check** before they enter the Google Fonts URL. `HEBREW_FONTS` being ASCII-safe is currently only a comment; this makes it a runtime check. Without it a family could pass the token validator and fail `fontsHref`'s `/^[\w\s-]+$/`, producing a silently broken site (styled with a font that never loads).
- `page.tsx:833`'s existing `brand_assets` interpolation is otherwise **not** touched.
- In preview, `StudioBridge` sets `rootEl.style.fontFamily` directly and writes a `[data-tier] h1, [data-tier] h2, [data-tier] h3` rule — (0,1,1), which beats `:829`'s (0,0,1) — into its own `<style id="studio-live">`, plus injects the `<link>`. Fonts stay instant.

`headingSize` map — `sm`: `clamp(1.5rem, 1.15rem + 1.1vw, 2.25rem)` · `md`: `clamp(1.75rem, 1.3rem + 1.6vw, 3rem)` (the current literal) · `lg`: `clamp(2rem, 1.4rem + 2.4vw, 4rem)`.
`headingTracking` map — `tight` `-0.03em` · `normal` `-0.01em` · `wide` `0.02em`.

#### Rhythm (3)

| key | Hebrew label | type | allowed | default | CSS var | applied where |
|---|---|---|---|---|---|---|
| `sectionRhythm` | רווח בין מקטעים | enum | `compact`\|`normal`\|`airy` | `normal` | `--t-section-py` | **M2, conditional — see below** |
| `contentWidth` | רוחב תוכן | number **rem** | 40–80 | `56` | `--t-measure` | `sharedCss` `:46` `[data-condensed]` max-width — **inert on 3 of 5 layouts; control is disabled there** |
| `gridColumns` | עמודות בחנות | enum | `2`\|`3`\|`4` | `3` | `--t-grid-cols` (unitless) | **M2** — `[data-el="product-grid"] { grid-template-columns: repeat(var(--t-grid-cols), minmax(0,1fr)) !important }` at `≥1024px` only |

`sectionRhythm` map — `compact` `2.5rem` · `normal` `4rem` · `airy` `clamp(4rem, 7vw, 8rem)`.
`gridColumns` M2 rule is wrapped in `@media (min-width: 1024px)` so mobile always stays 1-up and tablet 2-up — this is where the "responsive by construction" promise is literally enforced.

**`sectionRhythm` — two corrections forced by review.**

The earlier version claimed `normal` = 4rem "equals today's `py-16`" and mandated (in §J) that the rule be emitted **unconditionally** once any design exists. Both were wrong. `4rem` is not today's value for three live section types, verified in the files:

| element | today | under the unconditional rule |
|---|---|---|
| `app/s/[slug]/page.tsx:660` `<div key="reviews" data-el="module-section">` | **no padding class at all**; its child `components/public/site-reviews.tsx:44` is `px-4 py-16` | 4rem is added **on top of** the inner `py-16` — the reviews block grows by 8rem |
| `components/public/certifications-section.tsx:26` | `py-14` = 3.5rem | 4rem |
| `components/public/partners-section.tsx:25` | `py-14` = 3.5rem | 4rem |

So the design changes in two ways:

1. **The rule is emitted only when `sectionRhythm !== "normal"`.** `normal` means "leave the rhythm exactly as the components author it", which is what makes the AI's first design — and every design that does not deliberately re-space the page — a true no-op here. The old §J assertion demanding unconditional emission is **deleted and replaced by its opposite**; the `normal`-vs-unset discontinuity it worried about is precisely what keeps these three sections correct.
2. The selector is `[data-el="module-section"]:not([data-no-rhythm])`. `data-no-rhythm` is stamped by P6 on the **reviews wrapper** (`page.tsx:660`), which is a bare wrapper whose padding lives one level down — double-padding it is a defect at *any* rhythm value, not just at `normal`. P11 stamps it on `product/[productId]/page.tsx:211` (`py-8`) and `blog/page.tsx:90` / `blog/[postId]/page.tsx:149` (`py-10`) for the same reason: those are page shells, not page sections.

`certifications-section` and `partners-section` moving 3.5rem → the chosen rhythm at `compact`/`airy` is **intended** — the owner asked for a different rhythm and got one. It is called out here so it is not later filed as a bug.

**`contentWidth` — disabled on 3 of the 5 layouts, including the default.** Its only application point is `sharedCss:44-48`, which is scoped to `[data-condensed]`, and `data-condensed` is stamped only when `layout.hints.condensed` is true (`page.tsx:742-750`). Per `lib/site-layout.ts`, `condensed: true` exists on **`compact` (:139) and `express` (:160) only**; `flow` (:63, the default from `resolveSiteLayout`), `showcase` (:83) and `story` (:103) all use `DEFAULT_HINTS` with `condensed: false` (`:53-54`). On those three, every section uses its own hard-coded Tailwind width — re-verified line by line this session: `max-w-5xl` at `page.tsx:412`, `:434`, `:499`, `:508`, `:595`; `max-w-3xl` at `:464`, `:576`; `max-w-xl` at `:553`, `:688` — and the slider would move nothing across its whole 40–80rem range.

Decision: the control is **disabled with a Hebrew tooltip** — *"רוחב התוכן נקבע על ידי פריסת האתר. בחרו פריסה 'קומפקטי' או 'אקספרס' כדי לשלוט בו."* — whenever `resolveSiteLayout(website.layout_style).hints.condensed === false`. Widening the rule to override 8+ hard-coded containers is a much larger blast radius and is a §K non-goal. Since the AI now also picks `layoutStyle` (§H.2), an owner who wants the control can get it by accepting a condensed layout.

#### Motion (2)

| key | Hebrew label | type | allowed | default | CSS var | applied where |
|---|---|---|---|---|---|---|
| `motionSpeed` | קצב אנימציה | enum | `still`\|`calm`\|`normal`\|`lively` | `normal` | `--t-dur-fast`, `--t-dur-mid`, `--t-dur-slow`, `--t-ease` | `:345`, `:373`, `:377`, `:446`, `:472`, `:509` |
| `revealDistance` | עוצמת אנימציית כניסה | number **px** | 0–48 | `32` | `--t-rise` **+ derived** `--t-rise-page`, `--t-rise-hero` | `:508` reveal (`--t-rise` 32px), `app/s/[slug]/page.tsx:821` (`--t-rise-page` 26px), `:380` keyframe (`--t-rise-hero` 24px) |

`motionSpeed` map (fast / mid / slow):
`still` `0.001ms / 0.001ms / 0.001ms` · `calm` `.35s / .6s / 1.1s` · `normal` `.25s / .4s / .8s` (today) · `lively` `.15s / .25s / .45s`.
`--t-ease` collapses the **9 duplicated** `cubic-bezier(.22,.8,.3,1)` occurrences in `professionalCss` to one token; it is not owner-editable in v1 but is emitted so a future preset can retune it.

#### Buttons (4)

| key | Hebrew label | type | allowed | default | mechanism | applied where |
|---|---|---|---|---|---|---|
| `buttonStyle` | סגנון כפתורים | enum | `gradient`\|`solid`\|`outline` | `gradient` | **M2 + `data-btn` attribute** on the root | `:464-465` |
| `buttonPaddingX` | רוחב כפתור | number **rem** | 0.75–3 | `2` | `--t-btn-px` | `:468` |
| `buttonPaddingY` | גובה כפתור | number **rem** | 0.4–1.4 | `0.9` | `--t-btn-py` | `:469` |
| `buttonWeight` | עובי טקסט בכפתור | enum | `500`\|`600`\|`700`\|`800` | `600` | `--t-btn-weight` | `:470` |

> **The header CTA keeps its own fixed sizing on purpose.** `professionalCss:483-488` hard-codes `padding-inline: 1.15rem !important; padding-block: .5rem !important` for `[data-el="chrome-header"] [data-el="btn-primary"]`, because the section-CTA sizing rendered a ~48px pill inside a 64px bar. `buttonPaddingX`/`Y` therefore **do not** reach the header pill, by design. Documented so the next reviewer does not file it.

`buttonStyle` cannot be a value swap — `gradient` sets `background: linear-gradient(...)` and `color: #0a0a0a !important`, and `var()` cannot delete a declaration. So it is a data-attribute switch:

```css
[data-tier][data-design][data-btn="solid"] [data-el="btn-primary"] {
  background: var(--t-accent, var(--gold)) !important;
  color: var(--t-btn-ink, #0a0a0a) !important;
}
[data-tier][data-design][data-btn="outline"] [data-el="btn-primary"] {
  background: transparent !important;
  color: var(--t-accent, var(--gold)) !important;
  border: var(--t-border-w, 1px) solid var(--t-accent, var(--gold)) !important;
  box-shadow: none !important;
}
```

`--t-btn-ink` is **not owner-editable**. It is derived server-side by `inkOn(resolvedAccent)` — see §C.4. `tests/storefront-brand.test.ts:118-124` pins the `#0a0a0a` CTA ink, and that test's premise must survive.

#### Chrome (3)

| key | Hebrew label | type | allowed | default | CSS var | applied where |
|---|---|---|---|---|---|---|
| `headerOpacity` | אטימות סרגל עליון | number **%** | 40–100 | `72` | `--t-header-bg` | `:340` |
| `headerBlur` | טשטוש סרגל עליון | number **px** | 0–24 | `10` | `--t-header-blur` | `:341-342` |
| `ctaBandStrength` | עוצמת רצועת הסיום | number **%** | 0–40 | `18` | `--t-cta-mix` | `:415` |

`--t-header-bg` is emitted as `color-mix(in srgb, var(--t-surface-0, #000000) N%, transparent)`, so the header follows the ground colour.

#### Hero (2)

| key | Hebrew label | type | allowed | default | mechanism |
|---|---|---|---|---|---|
| `heroFill` | מילוי הכותרת הראשית | enum | `gradient`\|`flat` | `gradient` | **M2 + `data-hero-fill`**, stamped **only for `hero_style === "orbit"`** |
| `heroOverlay` | כהות רקע ה-Hero | number **%** | 0–70 | `0` | **M2** overlay rule, emitted **only when a hero image exists** |

```css
[data-tier][data-design][data-hero-fill="flat"] [data-el="hero"] h1 {
  background: none !important;
  color: var(--t-ink-0, #ffffff) !important;
  -webkit-text-fill-color: var(--t-ink-0, #ffffff) !important;
}
/* Emitted only when website.hero_image_url is non-null AND heroOverlay > 0.
   heroes/store-hero.tsx:100 is <div data-el="hero" className="relative">, so
   the absolute ::after is positioned against the hero itself — verified. */
[data-tier][data-design] [data-el="hero"]::after {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: rgba(0,0,0,calc(var(--t-hero-overlay, 0) / 100));
}
```

**The specificity claim in revision 1 was INVERTED. Correcting it, because the wrong version is the dangerous one.**

The theme rule is `[data-tier][data-design][data-hero-fill="flat"] [data-el="hero"] h1` = 4 attributes + 1 element = **(0,4,1)**, with `!important` on all three declarations. The hero blocks it competes with are, verbatim from `components/public/heroes/aurora-hero.tsx:58`:

```css
[data-tier="professional"] [data-el="hero"] h1.au-h1 {   /* (0,3,1) */
  background: none;                    /* NOT !important */
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff;    /* NOT !important */
  font-weight: 500;                    /* NOT !important */
```
`vanguard-hero.tsx:48` is identical in shape. **(0,4,1) beats (0,3,1)**, and the theme rule carries `!important` on all three properties, so `heroFill: "flat"` **does** repaint aurora's and vanguard's signature headline with `--t-ink-0`. Revision 1 claimed the opposite ("only visibly affects the orbit hero") and treated a greyed-out control as the mitigation — but §H.2's `designSystemSchema` has `hero: z.object({ heroFill: z.enum([...]) })` with no `.optional()`, so **the AI emits `heroFill` on every single generation**. A greyed-out control does not stop the model.

Three layers of enforcement, in code, not in UI copy:

1. **`page.tsx` stamps `data-hero-fill` only when `site.website.hero_style === "orbit"`.** This is the real gate: it is server-side, it survives a hand-crafted PostgREST PATCH of `design_live`, and it is one condition in a file P6 already owns.
2. **`clampDesignSystem` forces `heroFill = "gradient"` whenever the resolved `hero_style !== "orbit"`** (§H.3), so the stored draft never even claims otherwise.
3. The control is disabled with the Hebrew tooltip *"בסגנונות Hero מסוימים הכותרת מעוצבת בתוך הסגנון עצמו ואינה מושפעת מהבחירה הזו"* for every non-orbit hero.

**`heroOverlay` gets the same treatment for a different reason.** It is also required by the schema, and it paints up to 70% black over *any* of the 8 heroes — a brand-new visual element on components that were not designed with one. It is emitted **only when `website.hero_image_url` is non-null** (there is an image to darken), and `clampDesignSystem` forces it to `0` otherwise. On a gradient/canvas hero the control is disabled with *"זמין רק כשיש תמונת רקע ל-Hero"*.

`horizon-hero.tsx:89`, `nova-hero.tsx:78`, `soda-hero.tsx:420`, `denim-hero.tsx:139` and `spotlight-hero.tsx:160-176` carry the same class of override. **Do not** attempt to unify the 8 hero files in this project; that is an explicit non-goal (§K).

### C.3 Exact edits to `components/public/tiers/tier-styles.tsx`

All are inside `professionalCss()` unless noted. Format is `<line>: <old> → <new>`. Each is a pure literal→`var(…, literal)` wrap (M1); no declaration is added or removed in this file.

**P3 must re-derive these line numbers against the live file before applying anything.** The table is an *index*, not an address list — match on the old text, not on the number. Revision 1 had one confirmed drift here (the `509` row described two edits that live on two lines), and re-deriving the rest of the document surfaced **six more** elsewhere — see §I's *Citation hygiene* table. That is the failure mode this warning exists for, and it has now fired seven times in one document. Verified against the current file this session: `sharedCss:37/46/54`, `professionalCss:334-346, 352-354, 364-365, 373-380, 385-402, 410-425, 430-443, 446, 452-458, 464-472, 477, 483-488, 495-504, 508-509`.

**`sharedCss()`**
| line | change |
|---|---|
| 46 | `max-width: 56rem;` → `max-width: var(--t-measure, 56rem);` |

`sharedCss:37` (`border-radius: 2px` inside `:focus-visible`) is **deliberately not tokenised** — it is a pre-existing bug (it rounds the *element*, not the outline, and being unlayered at (0,3,0) it beats every Tailwind `rounded-*` while focused). Tokenising it would bake the bug into the scale. Fixing it is out of scope (§K).

**`professionalCss()` — colour**
| line | change |
|---|---|
| 334 | `--gold: color-mix(in srgb, var(--brand) 55%, #d4af6a);` → `--gold: var(--t-accent, color-mix(in srgb, var(--brand) 55%, #d4af6a));` |
| 335 | `background: #000000;` → `background: var(--t-surface-0, #000000);` |
| 336 | `color: #ffffff;` → `color: var(--t-ink-0, #ffffff);` |
| 340 | `background: rgba(0,0,0,.72) !important;` → `background: var(--t-header-bg, rgba(0,0,0,.72)) !important;` |
| 341-342 | `blur(10px)` ×2 → `blur(var(--t-header-blur, 10px))` ×2 |
| 343 | `1px solid rgba(255,255,255,.08)` → `var(--t-border-w, 1px) solid var(--t-hair-mid, rgba(255,255,255,.08))` |
| 345 | `color: #ececec; transition: color .25s ease;` → `color: var(--t-ink-1-hi, #ececec); transition: color var(--t-dur-fast, .25s) ease;` |
| 346 | `color: #ffffff;` → `color: var(--t-ink-0, #ffffff);` |
| 352 | `color: #ececec !important;` → `color: var(--t-ink-1-hi, #ececec) !important;` |
| 354 | `color: #ececec;` → `color: var(--t-ink-1-hi, #ececec);` |
| 385 | `background: #000000 !important;` → `background: var(--t-surface-0, #000000) !important;` |
| 386 | `color: #e5e5e5;` → `color: var(--t-ink-1-hi, #e5e5e5);` |
| 392 | `background: #121214 !important;` → `background: var(--t-surface-3, #121214) !important;` |
| 395 | `color: #f4f4f4 !important;` → `color: var(--t-ink-0, #f4f4f4) !important;` |
| 397 | `color: #c9c9c9 !important;` → `color: var(--t-ink-1, #c9c9c9) !important;` |
| 399 | `color: #b0b0b0 !important;` → `color: var(--t-ink-2, #b0b0b0) !important;` |
| 400 | `border-color: rgba(255,255,255,.1) !important;` → `border-color: var(--t-hair, rgba(255,255,255,.1)) !important;` |
| 410 | `background: #0b0b0d !important;` → `background: var(--t-surface-1, #0b0b0d) !important;` |
| 411 | `border-block: 1px solid rgba(255,255,255,.06);` → `border-block: var(--t-border-w, 1px) solid var(--t-hair-soft, rgba(255,255,255,.06));` |
| 415 | `var(--brand) 18%` → `var(--brand) var(--t-cta-mix, 18%)`; `#000 70%` → `var(--t-surface-0, #000) 70%` |
| 417 | `1px solid rgba(255,255,255,.08)` → `var(--t-border-w, 1px) solid var(--t-hair-mid, rgba(255,255,255,.08))` |
| 423 | `background: #0b0b0d !important;` → `background: var(--t-surface-1, #0b0b0d) !important;` |
| 424 | `border-color: rgba(255,255,255,.12) !important;` → `border-color: var(--t-hair-strong, rgba(255,255,255,.12)) !important;` |
| 432 | `color: #ffffff;` → `color: var(--t-ink-0, #ffffff);` |
| 441 | `background: #111214 !important;` → `background: var(--t-surface-2, #111214) !important;` |
| 442 | `border: 1px solid rgba(255,255,255,.08) !important;` → `border: var(--t-border-w, 1px) solid var(--t-hair-mid, rgba(255,255,255,.08)) !important;` |
| 495 | `background: #000000 !important;` → `background: var(--t-surface-0, #000000) !important;` |
| 496 | `1px solid rgba(255,255,255,.08)` → `var(--t-border-w, 1px) solid var(--t-hair-mid, rgba(255,255,255,.08))` |
| 497 | `color: #b8b8b8;` → `color: var(--t-ink-2, #b8b8b8);` |
| 499 | `color: #dcdcdc;` → `color: var(--t-ink-1-hi, #dcdcdc);` |
| 500 | `color: #ffffff;` → `color: var(--t-ink-0, #ffffff);` |
| 502 | `color: #f0f0f0 !important;` → `color: var(--t-ink-0, #f0f0f0) !important;` |
| 504 | `color: #b8b8b8 !important;` → `color: var(--t-ink-2, #b8b8b8) !important;` |

**`professionalCss()` — shape / type / spacing / motion**
| line | change |
|---|---|
| 364 | `font-weight: 200;` → `font-weight: var(--t-title-weight, 200);` |
| 365 | `letter-spacing: -0.02em;` → `letter-spacing: var(--t-hero-track, -0.02em);` |
| 373 | `.8s cubic-bezier(.22,.8,.3,1)` → `var(--t-dur-slow, .8s) var(--t-ease, cubic-bezier(.22,.8,.3,1))` |
| 377 | same, plus `.15s` delay untouched |
| 380 | `translateY(24px)` → `translateY(var(--t-rise-hero, 24px))` — **fallback stays 24px**, it is not the same value as `:508` |
| 402 | `box-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 8px 30px -14px rgba(0,0,0,.9) !important;` → `box-shadow: var(--t-shadow-panel, 0 0 0 1px rgba(255,255,255,.06), 0 8px 30px -14px rgba(0,0,0,.9)) !important;` |
| 425 | `box-shadow: 0 18px 40px -18px rgba(0,0,0,.95) !important;` → `box-shadow: var(--t-shadow-menu, 0 18px 40px -18px rgba(0,0,0,.95)) !important;` |
| 430 | `font-weight: 200;` → `font-weight: var(--t-title-weight, 200);` |
| 431 | `letter-spacing: -0.01em;` → `letter-spacing: var(--t-title-track, -0.01em);` |
| 435 | `font-size: clamp(1.75rem, 1.3rem + 1.6vw, 3rem);` → `font-size: var(--t-title-size, clamp(1.75rem, 1.3rem + 1.6vw, 3rem));` |
| 437 | `margin-bottom: 2rem;` → `margin-bottom: var(--t-title-gap, 2rem);` |
| 443 | `border-radius: 5px !important;` → `border-radius: var(--t-radius-card, 5px) !important;` |
| 446 | three `.4s cubic-bezier(.22,.8,.3,1)` / `.4s ease` → `var(--t-dur-mid, .4s) var(--t-ease, cubic-bezier(.22,.8,.3,1))` / `var(--t-dur-mid, .4s) ease` |
| 452-454 | the two-layer hover halo → `box-shadow: var(--t-shadow-card-hover, 0 0 0 1px color-mix(in srgb, var(--gold) 35%, transparent) inset, 0 22px 46px -20px color-mix(in srgb, var(--gold) 65%, transparent)) !important;` |
| 458 | `font-family: ui-monospace, …` → `font-family: var(--t-font-mono, ui-monospace, "SFMono-Regular", Menlo, monospace);` |
| 467 | `border-radius: 50px !important;` → `border-radius: var(--t-radius-btn, 50px) !important;` |
| 468 | `padding-inline: 2rem !important;` → `padding-inline: var(--t-btn-px, 2rem) !important;` |
| 469 | `padding-block: .9rem !important;` → `padding-block: var(--t-btn-py, .9rem) !important;` |
| 470 | `font-weight: 600;` → `font-weight: var(--t-btn-weight, 600);` |
| 471 | `box-shadow: 0 8px 26px -10px color-mix(…70%…);` → `box-shadow: var(--t-shadow-btn, 0 8px 26px -10px color-mix(in srgb, var(--gold) 70%, transparent));` |
| 472 | three `.3s cubic-bezier(.22,.8,.3,1)` / `.3s ease` → `var(--t-dur-fast, .3s) var(--t-ease, …)` |
| 477 | `box-shadow: 0 14px 34px -10px color-mix(…80%…);` → `box-shadow: var(--t-shadow-btn-hover, 0 14px 34px -10px color-mix(in srgb, var(--gold) 80%, transparent));` |
| **508** | `transform: translateY(32px);` → `transform: translateY(var(--t-rise, 32px));` |
| **509** | `transition: opacity .4s cubic-bezier(…), transform .8s cubic-bezier(…);` → `var(--t-dur-mid, .4s) var(--t-ease, …)` / `var(--t-dur-slow, .8s) var(--t-ease, …)` |

> The `508` / `509` split is the one confirmed citation drift from revision 1, which described both edits on a single row numbered `509`. Verified this session: `508` is the `transform`, `509` is the `transition`.

**Explicitly NOT edited in this file:** `:465` (`color: #0a0a0a !important` — see §C.4), `:483-488` (the header-CTA padding override — see the note under the Buttons table), `:388-403` selectors (a `var()` cannot appear in a selector), `:54` and `:279` media preludes, every `!important` keyword (a var cannot carry it — a business can change a *value* but can never opt out of an override).

**`prefers-reduced-motion` is verified safe.** `sharedCss:54-61` stays unlayered, keeps its `!important` on `animation-duration` / `transition-duration`, and is not tokenised — so `motionSpeed` can never override a visitor's reduced-motion preference. Do not tokenise that block.

`--t-shadow-*` are set as a group by the `shadowDepth` enum; `none` emits `none`, `deep` roughly doubles blur+alpha. `--t-hair-soft/-mid/-strong`, `--t-ink-1-hi`, `--t-rise-page`, `--t-rise-hero` and `--t-font-mono` are **derived** — emitted by the `emit` of `hairlineStrength` / `inkBody` / `revealDistance` / a fixed value, and never separately owner-editable.

### C.4 WCAG AA enforcement on owner colour choices

Runs in **two places with the same pure function**, so the UI warning and the stored value can never disagree:

```ts
// lib/site-design.ts
export interface ContrastIssue {
  pair: string;            // "inkBody-on-surfaceBase"
  ratio: number;           // measured
  required: number;        // 4.5 or 3
  fixedTo: string;         // the hex we would use instead
  label: string;           // Hebrew, for the studio
}

/** Every ink/ground pair the tier CSS actually paints. Order matters: the
 *  first failing pair is the one the studio surfaces first. */
export function auditContrast(t: ResolvedTokens): ContrastIssue[];

/** Returns a copy of `t` with every failing ink pushed to AA, using the same
 *  helpers the storefront already trusts. Never rejects, never throws. */
export function autoCorrectContrast(t: ResolvedTokens): ResolvedTokens;
```

Pairs audited (using `contrastRatio` from `lib/storefront-brand.ts:43`):

| pair | required | correction |
|---|---|---|
| `inkStrong` on `surfaceBase` | 4.5 | `inkOn(surfaceBase)` |
| `inkBody` on `surfaceBase` | 4.5 | lift/darken toward `inkOn(surfaceBase)` via `brandOnDark`/`brandInk` depending on `relativeLuminance(surfaceBase) < 0.45` |
| `inkMuted` on `surfaceBase` | 4.5 | same |
| `inkStrong` on `surfaceCard` | 4.5 | same, against `surfaceCard` |
| `inkBody` on `surfacePanel` | 4.5 | same, against `surfacePanel` |
| `inkMuted` on `surfaceRaised` | 4.5 | same, against `surfaceRaised` |
| `accent` on `surfaceBase` | 3.0 (non-text: borders, halos, price glyph) | `brandOnDark(accent, surfaceBase, 3)` when the ground is dark, `brandInk(accent, surfaceBase, 3)` when light |
| **derived** `--t-btn-ink` on `accent` | 4.5 | **always** `inkOn(accent)` — never owner-set |

**Behaviour split, deliberately different in the two places:**
- **In the studio (client):** `auditContrast` runs on every change and shows an amber inline note under the offending swatch with the measured ratio and a **תקנו לי** button that applies `autoCorrectContrast`. The owner is *allowed* to sit on a failing draft — nagging on every slider tick is worse than a warning.
- **On publish (server action):** `publishDesignAction` runs `autoCorrectContrast` **unconditionally** and stores the corrected tokens. The owner is told what changed: `"התאמנו 2 צבעים כדי שהטקסט יישאר קריא"`.

**Where the guarantee actually holds — corrected.** Revision 1 said "an unreadable design cannot reach a live site … enforced on the server so a crafted PostgREST PATCH cannot bypass it", and then §I/P1 admitted in the same document that an owner *can* PATCH `design_live` directly. Both cannot be true, and an implementer citing the first would be justified in relaxing the read-side validator. The correct statement, which is also the useful one:

> The AA guarantee holds for every design written through `publishDesignAction` — i.e. everything the studio can produce. It is **not** a boundary against a hand-crafted PostgREST PATCH by the site's own owner, whose blast radius is their own site.
> **The read-side `resolveDesignConfig` is the real security boundary.** It runs on every render, it drops every malformed value, and nothing reaches CSS without passing it. That is what makes a PATCHed `design_live` unable to do anything worse than look bad.

`safeDesignHex`'s rejection of 8-digit hex (§C.1) is load-bearing here: without it `inkBody: "#c9c9c900"` measures ~11:1 (the alpha is discarded by `hexToRgb`), passes `auditContrast`, survives `autoCorrectContrast`, and renders invisible text.

`DARK_GROUND` (`lib/storefront-brand.ts:117`) stays `#1d1d1f` and `brandForDarkGround` is **not** changed. `tests/storefront-brand.test.ts:107` hard-codes the tier's surface hexes as the set it must clear; making surfaces themable does not invalidate that test, because the *unthemed* surfaces are still exactly those hexes, and a themed surface is covered by `auditContrast` instead. Say so in a comment in the test file (no assertion change).

---

## D. Section + element model

### D.1 Stored shape

```ts
// lib/site-sections.ts
export interface SectionOverrides {
  /** Owner's order. Partial is fine — missing keys are appended in preset order. */
  order?: SiteSectionKey[];
  /** Sections the owner switched off. */
  hidden?: SiteSectionKey[];
  /** Per-section presentation. Absent key = preset behaviour. */
  props?: Partial<Record<SiteSectionKey, SectionProps>>;
}

export interface SectionProps {
  align?: "start" | "center" | "end";
  size?: "sm" | "md" | "lg";
  /** Order of the named slots inside this section (see sectionSlotsFor). */
  slots?: string[];
  /** Slots the owner hid inside this section. */
  slotsHidden?: string[];
  /** Hebrew title override. Only honoured for sections in TITLE_EDITABLE.
   *  RENDERED ON THE SERVER as a React text child — never through CSS. */
  title?: string;
  /** benefits only: one lucide icon name per card, from BENEFIT_ICONS. */
  icons?: string[];
}
```

Stored at `design.sections` inside `websites.design_live` / `design_draft`.

### D.2 The slot registry

```ts
// lib/site-sections.ts — closed registries; anything not listed here is dropped.

export const SECTION_SLOTS: Partial<Record<SiteSectionKey, readonly string[]>> = {
  about:    ["title", "body", "values", "media"],
  services: ["title", "intro", "cards"],
  store:    ["title", "categories", "filters", "grid"],
  booking:  ["title", "widget"],
  faq:      ["title", "items"],
  contact:  ["title", "form", "location"],
};

/** Slots ACTUALLY PRESENT for a given render context. The registry above is the
 *  superset; this is what the studio may offer and what designToCss may target. */
export function sectionSlotsFor(
  key: SiteSectionKey,
  ctx: { aboutVariant: "default" | "split"; hasHeroImage: boolean },
): readonly string[] {
  if (key !== "about") return SECTION_SLOTS[key] ?? [];
  // page.tsx:433 renders the two-column split ONLY when
  // `aboutVariant === "split" && heroImg`. In every other case the about
  // section has NO media child at all (the `: (` branch at page.tsx:463, whose
  // container is `<div class="relative mx-auto max-w-3xl">` at :464), so a
  // "media" toggle would be a control that visibly does nothing.
  // And under the split the section's children are the two grid columns, not
  // named slots — so about has no slot editing there at all.
  if (ctx.aboutVariant === "split" && ctx.hasHeroImage) return [];
  return ["title", "body", "values"];
}

/** Sections whose <h2> is rendered somewhere P4/P6 can thread a prop into. */
export const TITLE_EDITABLE: SiteSectionKey[] = [
  "about", "services", "store", "booking", "faq", "contact",
];

/** Sections where a per-section align rule LANDS COMPLETELY. Verified against
 *  the markup; see the note under §D.4. Everything else is offered without
 *  align, because half-applied alignment reads as a broken editor. */
export const ALIGN_CAPABLE: SiteSectionKey[] = ["about", "services", "faq", "contact"];

/** Owner-facing names. Three keys have no comprehensible Hebrew NAME, so they
 *  get a DESCRIPTION instead — an owner deciding whether to hide a row needs
 *  to know what it is, and "רצועה" is a row nobody will ever touch. */
export const SECTION_LABELS: Record<SiteSectionKey, { label: string; hint: string }> = {
  benefits:      { label: "יתרונות",        hint: "שלושת הקלפים עם הסימון הירוק מתחת ל-Hero" },
  about:         { label: "עלינו",          hint: "הסיפור של העסק" },
  services:      { label: "שירותים",        hint: "מה אתם מציעים" },
  store:         { label: "החנות",          hint: "רשת המוצרים והסינון" },
  booking:       { label: "קביעת תור",      hint: "היומן להזמנת תורים אונליין" },
  faq:           { label: "שאלות ותשובות",  hint: "השאלות הנפוצות" },
  orderTracking: { label: "מעקב הזמנות",    hint: "טופס לבדיקת סטטוס הזמנה" },
  rentals:       { label: "השכרות",         hint: "פריטים להשכרה" },
  modules:       { label: "מקטעים נוספים",  hint: "המקטעים שהפעלתם במסך «מקטעים»" },
  reviews:       { label: "ביקורות לקוחות", hint: "חוות דעת שאישרתם" },
  band:          { label: "רצועת סיום",     hint: "רצועה דקורטיבית לפני יצירת הקשר" },
  contact:       { label: "צרו קשר",        hint: "טופס הפניות — ערוץ הלידים שלכם" },
};

/** Closed lucide set for the benefits cards. Same discipline as HEBREW_FONTS:
 *  a name outside this list is dropped, never rendered dynamically. */
export const BENEFIT_ICONS = [
  "CheckCircle2", "Star", "Heart", "Shield", "Truck", "Clock",
  "Award", "Sparkles", "ThumbsUp", "Gift", "Leaf", "Zap",
] as const;
```

Slot editing is offered only where `sectionSlotsFor(key, ctx).length >= 2`. `benefits`, `orderTracking`, `rentals`, `modules`, `reviews`, `band` get order / visibility / size only — they have one meaningful block each, or (for `modules`) their own internal ordering UI at `/sections`.

**The inspector greys out what is not there.** `sectionSlotsFor` is the server's view; the iframe's `ready` message additionally reports `slots: { [key]: string[] }` — the `[data-slot]` nodes that actually exist in the rendered DOM — and the inspector disables any toggle whose node is absent, with a Hebrew tooltip. Two independent sources agreeing is what stops "a control that does nothing" from ever shipping again.

### D.3 The resolver

```ts
export interface ResolvedSectionPlan {
  /** Every SiteSectionKey exactly once, in render order. */
  order: SiteSectionKey[];
  hidden: Set<SiteSectionKey>;
  props: Record<SiteSectionKey, SectionProps>;   // total; {} for untouched keys
}

export function resolveSectionPlan(
  raw: unknown,
  preset: SiteSectionKey[],          // layout.sections from lib/site-layout.ts
): ResolvedSectionPlan;
```

Behaviour, mirroring `resolveModules` (`lib/modules.ts:126-145`) exactly:

| input | result |
|---|---|
| `undefined` / `null` / `"x"` / `[1,2]` / `42` | `{ order: preset, hidden: ∅, props: {} }` — i.e. **today** |
| `order` contains an unknown key (`"portal"`, `"shop"`) | dropped silently |
| `order` contains a duplicate | first occurrence wins, later ones dropped |
| `order` omits keys present in `preset` | missing keys **appended in preset order** — so a section can never vanish because the stored array is stale |
| a **new** `SiteSectionKey` is added to the registry later | it is not in any stored `order`, so it lands at its preset position automatically. This is the reason for append-not-drop. |
| `hidden` contains an unknown key | dropped |
| `props` contains an unknown section key | dropped |
| `props[k].slots` contains an unknown slot | dropped; missing slots appended in `SECTION_SLOTS[k]` order |
| `props[k].align`/`size` not in the enum | field dropped (falls back to preset) |
| `props[k].align` for a key not in `ALIGN_CAPABLE` | dropped |
| `props[k].title` longer than 80 chars | truncated to 80 |
| `props[k].title` for a key not in `TITLE_EDITABLE` | dropped |
| `props[k].icons` for a key other than `benefits` | dropped |
| `props[k].icons` entry not in `BENEFIT_ICONS` | that entry replaced with `"CheckCircle2"` (today's literal) |
| top-level `history` / `undo` keys (§F.4, §H.5) | ignored here — they are siblings of `tokens`/`sections`, never part of the plan, and `resolveDesignConfig` drops them from the emitted design |

### D.4 Application in `app/s/[slug]/page.tsx`

Today, `orderedSections` is built at `:739-753` from `layout.sections`. The change is surgical — four insertions, no restructuring:

**1)** After `const layout = resolveSiteLayout(...)` (`:373`):

```ts
// Owner overrides from the design studio. An absent/empty design resolves to
// the preset order with nothing hidden, so a business that never opened the
// studio renders through the identical code path it did before.
const design = resolveDesignConfig(site.website.design_live);
const plan = resolveSectionPlan(design?.sections, layout.sections);
const slotCtx = { aboutVariant, hasHeroImage: Boolean(heroImg) };
```

**2)** Replace the `layout.sections.map(...)` body at `:739-753`:

```tsx
  const primaryKeys: SiteSectionKey[] = ["store", "booking", "faq", "contact"];
  // The wrapper is emitted for EVERY ordered section as soon as the page is
  // themed or being previewed, because StudioBridge reorders by moving these
  // exact elements in the DOM and therefore needs one stable handle per
  // section. When there is no design and we are not in studio mode, the old
  // condition is preserved byte-for-byte, so the ~9 live sites are untouched.
  const wrapAll = Boolean(design) || Boolean(studioBusinessId);
  const orderedSections = plan.order.map((key) => {
    // NOTE: gated sections are `false`/`undefined`, not null (the `x && <jsx>`
    // idiom at :411, :540, :551, :573, :594, :668) — truthiness, never `!== null`.
    if (plan.hidden.has(key)) return null;
    const node = sectionByKey[key];
    if (!node) return null;
    const p = plan.props[key];
    const needsCondensed = condensed && !primaryKeys.includes(key);
    if (!needsCondensed && !wrapAll) return node;
    return (
      <div
        key={key}
        // display:contents — a real box clips full-bleed section backgrounds to
        // 56rem and breaks sticky/absolute children. Both the condensed rule and
        // the studio's per-section rules land on the section's own children.
        {...(needsCondensed ? { "data-condensed": "" } : {})}
        {...(wrapAll ? { "data-sec": key } : {})}
        {...(p?.align ? { "data-align": p.align } : {})}
        {...(p?.size ? { "data-size": p.size } : {})}
        className="contents"
      >
        {node}
      </div>
    );
  });
```

**`data-sec` is now unconditional (given a design or studio mode) — this is a design change, and it is the fix for the single worst bug in revision 1.** Revision 1 stamped `data-sec` only when `plan.props[key]` existed. Dragging changes `order`, never `props`, so a section the owner *only reordered* carried no `data-sec` at all and the preview had nothing to target. See the reorder mechanism below.

**Critical invariant preserved:** the wrapper stays `className="contents"` in *every* branch. The `[data-condensed]` selectors in `tier-styles.tsx:44-48` only reach `[data-el="module-section"]` at DOM depth 1 or 2 — this wrapper adds exactly the depth the old one added, so `compact`/`express` behave identically, including the known-and-accepted quirk that `modulesSection` sits at depth 3 and is therefore not narrowed.

**2b)** Stamp `data-no-rhythm` on the reviews wrapper (`:660`), whose padding lives one level down in `site-reviews.tsx:44` (§C.2).

**3)** Root div (`:782-786`) and `<ThemeStyle>`:

```tsx
    <div
      data-tier={tier}
      {...(design ? { "data-design": "" } : {})}
      {...(design?.tokens.buttonStyle ? { "data-btn": design.tokens.buttonStyle } : {})}
      {...(design?.tokens.heroFill && site.website.hero_style === "orbit"
        ? { "data-hero-fill": design.tokens.heroFill }
        : {})}
      className="min-h-screen bg-zinc-50 text-zinc-900"
      style={
        effectiveBodyFont
          ? { fontFamily: `'${effectiveBodyFont}', Heebo, sans-serif` }
          : undefined
      }
    >
```

The `hero_style === "orbit"` condition is the server-side enforcement of §C.2's heroFill gate — it is what makes the greyed-out control real.

`<ThemeStyle design={design} plan={plan} ctx={slotCtx} />` is placed immediately after the inline `<style>` at `:830`. **It is the last stylesheet emitted by the page shell, but 13 component-level `<style>` tags render after it** (all 8 heroes, `hud-frame`, `marquee-band`, `statement-section`, `liquid-glass`). Every `ThemeStyle` rule therefore wins on **specificity**, never on document order — see §C.1.

**4)** `translateY(26px)` in the inline `[data-reveal]` block at `:821` → `translateY(var(--t-rise-page, 26px))`. **The fallback stays 26px.** It is a *different* value from `tier-styles.tsx:508`'s 32px and from `:380`'s 24px, and all three must stay different for the empty-config guarantee to hold. `revealDistance` drives all three through the derived ramp in §C.2 — this is *tokenising three values that share one control*, not *unifying three values into one*.

#### The M2 rules `<ThemeStyle>` emits for sections

```css
/* size — a variable override, no layout risk */
[data-tier][data-design] [data-sec="faq"][data-size="lg"] { --t-title-size: clamp(2rem, 1.4rem + 2.4vw, 4rem); }

/* align — ONLY for keys in ALIGN_CAPABLE, and it targets the heading too,
   because e.g. page.tsx:500's h2 carries its own `text-center` utility that a
   rule on the PARENT cannot override. */
[data-tier][data-design] [data-sec="services"][data-align="end"] [data-el="module-section"] > *,
[data-tier][data-design] [data-sec="services"][data-align="end"] [data-el="module-section"] [data-el="section-title"] {
  text-align: end;
}

/* slot order — emitted ONLY when a non-identity order or a hidden slot is
   actually stored, and never for a section whose sectionSlotsFor() is empty. */
[data-tier][data-design] [data-sec="about"] > [data-el="module-section"] > *:not(.grid) {
  display: flex; flex-direction: column;
}
[data-tier][data-design] [data-sec="about"] [data-slot="body"]  { order: 1; }
[data-tier][data-design] [data-sec="about"] [data-slot="title"] { order: 2; }
[data-tier][data-design] [data-sec="about"] [data-slot="values"] { display: none; }
```

**Three corrections to the slot rule, all forced by review.**

1. **It must not fire for the `story` layout's split about.** `lib/site-layout.ts:120` gives `story` `aboutVariant: "split"`, and `app/s/[slug]/page.tsx:434` renders that as `<div className="relative mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2" data-reveal>` — the section's **sole direct child**. `display: flex; flex-direction: column` on it overrides `md:grid-cols-2` (the theme rule is unlayered, Tailwind is in `@layer utilities`), collapsing the two-column text+image split — *the entire reason the `story` layout exists* — into a stack on desktop. `sectionSlotsFor` returns `[]` for `about` under the split variant, so no rule is emitted at all; the `:not(.grid)` carve-out is a second, independent belt.
2. **It is emitted only when the owner actually stored a slot ordering** — not merely because `props.about` exists for some other reason (an `align`, a `title`). An identity order emits nothing.
3. `page.tsx` and `public-store.tsx` stamp `data-slot="…"` on the direct children of each section's inner container. An unstyled `data-slot` attribute changes nothing, and P0's parity run proves it.

#### Section title overrides — the published render path

Revision 1 stored, validated and truncated `props[k].title` and then **never rendered it on the published page**. CSS cannot replace element text, §I/P6 did not thread it anywhere, and §E.5 applied it only in the iframe — so an owner would have renamed a heading, watched it change in the preview, pressed פרסום, and found the live site unchanged. Fixed:

- **P6** reads `plan.props[key]?.title` and passes it down as a plain React text child: `{plan.props.contact?.title ?? contact?.headline ?? "צרו קשר"}`, and the equivalent at every other editable heading. All six `TITLE_EDITABLE` headings were located by `grep -n 'data-el="section-title"'` **this session**, and these are the exact addresses P6 edits (match on the surrounding text, not the number):

  | key | file:line | today's text |
  |---|---|---|
  | `about` (split variant) | `page.tsx:436` | `{about.headline}` |
  | `about` (default variant) | `page.tsx:465` | `{about.headline}` |
  | `services` | `page.tsx:500` | `{services.headline}` |
  | `booking` | `page.tsx:554` | `קביעת תור אונליין` (a hard-coded string — the one case where a title override is purely additive) |
  | `faq` | `page.tsx:577` | `{faq.headline}` |
  | `contact` | `page.tsx:689` | `{contact?.headline ?? "צרו קשר"}` |
  | `store` | `public-store.tsx:381` | `<ShoppingBag/>` + `החנות שלנו` — **P4**, via the new `title` prop |

  Note that `about` has **two** headings, one per variant, and both must take the override or the control is half-broken on the `story` layout.
- **P4** gives `<PublicStore>` a `title?: string` prop defaulting to `"החנות שלנו"`.
- **The title override MUST NOT be implemented through CSS `content:` on a pseudo-element.** It would put an 80-character owner string inside a CSS string literal in a server-emitted `<style>`; React's text-child escaping makes that a broken-CSS bug rather than an injection today, but it is one `dangerouslySetInnerHTML` refactor away from being one. §J asserts `designToCss` never emits `content:`.
- In preview, `StudioBridge` mutates **only the last text node** of `[data-sec="k"] [data-el="section-title"]`, never `textContent`. `public-store.tsx:381-384` is `<h2 data-el="section-title">…<ShoppingBag/> החנות שלנו</h2>` — setting `textContent` would delete the icon SVG. If no text node is found, the bridge falls back to a `{type:"reload"}`.

#### Benefit icons

`props.benefits.icons[i]` selects the lucide component for card *i* from `BENEFIT_ICONS`; **`page.tsx:421`**'s hard-coded `<CheckCircle2 className="mb-3 size-6" style={{ color: brand }} />` becomes a lookup with `CheckCircle2` as the default, so an absent/unknown value renders exactly today's icon. Closed registry, static import map — no dynamic `lucide-react` import.

> **There are two `<CheckCircle2>` call sites in this file.** `:421` (`className="mb-3 size-6"`) is the benefits card and is the one that becomes a lookup. `:527` (`className="mt-0.5 size-4 shrink-0"`) is a bullet inside the services cards and is **not** owner-editable. Match on the `className`, not on `CheckCircle2`.

**Landing mode.** The landing branch returns at `page.tsx:268` before any of this and renders no `data-tier` and no `<TierStyles>`. Insertion (1) is placed *after* that branch, so landing is untouched by the section model **and by the entire token engine**. What the studio shows for landing is in §F.6 — and revision 1's claim there was wrong; it is corrected.

---

## E. Live preview

### E.1 Approach

A same-origin `<iframe src="/s/{key}?studio=1">` inside the studio, where `{key}` is `website.slug` when one exists and `business.id` when it does not. Authorisation is an **httpOnly cookie**, never a URL parameter.

Rejected alternatives, with the reason:
- **A separate `/studio-preview/[businessId]` route.** Would duplicate all 1025 lines of `app/s/[slug]/page.tsx`, and the duplicate would rot. Rejected.
- **`?studio={token}` in the URL.** Layouts do not receive `searchParams` in the App Router, and `app/s/[slug]/layout.tsx:36` is the real 404 guard that must be bypassed. A token in a URL also leaks through `Referer`, browser history and any logging. Rejected.
- **Rendering the storefront into the studio page directly (no iframe).** The storefront's unlayered `<style>` tags would escape into the dashboard and repaint it black. Rejected.

**Cost check:** reading `cookies()` in `app/s/[slug]/layout.tsx` makes it dynamic. That is free here — `app/s/[slug]/page.tsx:182` already calls `getCustomerUser()`, which calls `createClient()`, which awaits `cookies()`. The route is already fully dynamic; nothing regresses.

### E.2 The cookie

Minted by `POST /api/studio/preview-session`, cleared by `DELETE` on the same route.

```
name:     studio_preview
value:    v1.<businessId>.<userId>.<expEpochSeconds>.<base64url(hmacSha256(secret, "v1.<businessId>.<userId>.<exp>"))>
httpOnly: true
sameSite: "lax"
secure:   process.env.NODE_ENV === "production"
path:     "/s"
maxAge:   900        // 15 min, re-minted by the studio's heartbeat
```

**The `userId` segment is a design change.** Revision 1's payload was `v1.<businessId>.<exp>` — a 30-minute bearer credential bound to a business but to no session, which nothing revoked. Signing out on a shared or kiosk browser left the unpublished draft readable at `/s/<slug>`; removing a team member's access did not revoke a preview they had already minted (`is_business_owner` was widened to active members by `0067_business_members.sql:59-64`, so members can mint); and the token survived a business transfer. The storefront now requires `verifyPreviewToken(...).userId === (await getCustomerUser())?.id`.

**This costs zero extra round trips on the hot path.** `lib/auth/customer.ts:13-19`'s `getCustomerUser()` is byte-for-byte `getUser()` — same `createClient()`, same `supabase.auth.getUser()` — and `app/s/[slug]/page.tsx:181` already calls it inside its `Promise.all`. The page reuses `customerUser.id`. Only `layout.tsx` pays one auth call, and only when a preview cookie is actually present.

**The secret must fail hard, not fall back to an empty string.**

```ts
// lib/studio-preview.ts
const SECRET = process.env.STUDIO_PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SECRET || SECRET.length < 32) throw new Error("STUDIO_PREVIEW_SECRET missing or too short");
```
`||`, **never `??`**. `??` falls through only on `null`/`undefined`; a Vercel env var set to an empty string is `""`, which `??` happily accepts and which is a perfectly valid HMAC key. With an empty key the token format is fully public and anyone can mint one for any business — and `getDraftSiteByBusinessId` accepts `businessId === slugOrId`, so an attacker would not even need a slug. Business uuids are not secret: `app/s/[slug]/page.tsx:810` ships `businessId={site.website.business_id}` into the client `<StoreChatWidget>` on every published storefront. `tests/studio-preview.test.ts` asserts the module **throws** with the env unset — revision 1's four listed cases all pass with an empty key.

**`verifyPreviewToken` must be total. `crypto.timingSafeEqual` throws.**

Node's `timingSafeEqual` raises `RangeError: Input buffers must have the same byte length` on a length mismatch; it does not return `false`. And this function now runs on **every request from every anonymous visitor to every customer's live storefront** (both `layout.tsx` and `page.tsx`). A truncated cookie, a stale token after any format change, a v1→v2 rollout, or a second same-named cookie planted by any same-origin script (`httpOnly` does not stop `document.cookie` from *creating* one) would turn into an uncaught exception in the layout and return **500 instead of the site** — for every route under `/s`, including checkout, and stickily, because the bad cookie persists in the browser.

```ts
export function mintPreviewToken(businessId: string, userId: string, nowMs: number): string;

export function verifyPreviewToken(
  token: string | undefined,
  nowMs: number,
): { businessId: string; userId: string } | null {
  try {
    const m = /^v1\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(token ?? "");
    if (!m) return null;                                   // strict parse FIRST
    const [, businessId, userId, exp, sig] = m;
    if (Number(exp) * 1000 <= nowMs) return null;
    const expected = sign(`v1.${businessId}.${userId}.${exp}`);
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.byteLength !== b.byteLength) return null;         // BEFORE timingSafeEqual
    return timingSafeEqual(a, b) ? { businessId, userId } : null;
  } catch {
    return null;                                            // total, always
  }
}
```
`tests/studio-preview.test.ts` gains a case for a signature of the **wrong length** — the "tamper" case uses a same-length mutation and misses this entirely.

`nowMs` is a parameter, not `Date.now()` inside the function, so the module stays unit-testable. **That alone does not satisfy `react-hooks/purity`** — see §E.3.

### E.3 Draft authorisation on the storefront

**`Date.now()` MUST NOT appear in either component body. This is a hard build error, not a style preference.**

Revision 1 specified `verifyPreviewToken((await cookies()).get(…)?.value, Date.now())` verbatim inside both async server component bodies. A reviewer proved with this repo's own eslint that this fails:

```
app/__purity_probe/page.tsx
  2:15  error  Cannot call impure function during render ...  react-hooks/purity
```

`react-hooks/purity` is an **error** here, so P5 and P6 would not have linted, let alone built. And revision 1's stated mitigation — "`mintPreviewToken` takes `nowMs` as a parameter" — does not help at all: the impure **call site** is still in the component body. (`page.tsx:248`'s `new Date(site.website.created_at).getFullYear()` is fine; `new Date(arg)` is deterministic and only the zero-arg / `Date.now()` forms trip the rule.)

The clock read moves into a lowercase, non-component, module-level helper — verified to pass eslint with zero output:

```ts
// lib/studio-preview.ts
/** Reads the clock OUTSIDE any render body. Lowercase, not a component, not a
 *  hook — react-hooks/purity does not apply. Never inline Date.now() at a call
 *  site inside a server component; it is a build-breaking lint error. */
export async function readStudioSession(
  cookieValue: string | undefined,
): Promise<{ businessId: string; userId: string } | null> {
  return verifyPreviewToken(cookieValue, Date.now());
}
```

**`app/s/[slug]/layout.tsx`:**

```ts
  // Studio preview: a verified, short-lived, httpOnly cookie bound to BOTH the
  // business and the signed-in user is the ONLY way an unpublished draft is
  // served. The basics lookup is NEVER skipped — see the note below.
  const session = await readStudioSession((await cookies()).get("studio_preview")?.value);
  const basics = await getPublicSiteBasicsBySlug(slug).then(
    (value) => ({ resolved: true, value }),
    () => ({ resolved: false, value: null }),
  );
  const isOwnDraft = Boolean(session) && (
    slug === session!.businessId || basics.value?.businessId === session!.businessId
  );
  if (basics.resolved && !basics.value && !isOwnDraft) notFound();
```

**The bypass is gated on a MATCH, not on the cookie's existence.** Revision 1 skipped `getPublicSiteBasicsBySlug` and `notFound()` whenever *any* valid cookie was present — and because the cookie's path is `/s`, that applied to every slug and every sub-route for 30 minutes. That is precisely the failure the layout's own docblock exists to prevent (`app/s/[slug]/layout.tsx:8-19`: a `notFound()` further down arrives after the 200 headers and produces a soft 404). There is no data leak behind it — every sub-route does its own published-only lookup (`accessibility/page.tsx:83-84`, `help/page.tsx:58-59`, `terms/page.tsx:56-57`, `blog/page.tsx:44-45`, `page.tsx:180-184`, all through queries pinned with `.eq("published", true)` at `website.service.ts:166`) — but a 200-then-404 for the owner is a bug, and the wasted fan-out is real.

`getPublicSiteBasicsBySlug` therefore returns `{ mode, businessId }` instead of `{ mode }` (it already selects `business_id` at `website.service.ts:92 `— the field is simply discarded today). The brand-new never-published-slug case is decided explicitly: the iframe key is `business.id` when no slug exists (§E.1), and `slug === session.businessId` is the first arm of `isOwnDraft`, so it resolves.

**`app/s/[slug]/page.tsx`, replacing the single `getPublicSiteBySlug(slug)` at `:180`:**

```ts
  const session = await readStudioSession((await cookies()).get("studio_preview")?.value);
  // customerUser comes from the SAME Promise.all that already runs today.
  const studioBusinessId =
    session && customerUser?.id === session.userId ? session.businessId : null;
  const site = studioBusinessId
    ? await getDraftSiteByBusinessId(studioBusinessId, slug)
    : await getPublicSiteBySlug(slug);
```

`getDraftSiteByBusinessId(businessId, slugOrId)` (new, in `lib/services/website.service.ts`):
- Service-role, same fan-out as `getPublicSiteBySlug`, **without** `.eq("published", true)`.
- **Asserts the match**: returns `null` unless `website.business_id === businessId` **and** (`website.slug === cleanSlug(slugOrId)` **or** `businessId === slugOrId`). A cookie for business A therefore cannot render business B's draft even if the attacker guesses B's slug.
- Products `.limit(200)` instead of 24 — the category sidebar must be right in the preview. **This does not touch `getPublicSiteBySlug`'s limit**; see §G.3.
- Reads `design_draft` into the returned `website` row's `design_live` position, **and overlays `design_draft.chrome.heroStyle` / `.layoutStyle` onto `hero_style` / `layout_style`**, at the service boundary — so `page.tsx` has exactly one code path and never branches on "am I a preview". This is the single most important simplification in the whole feature.
- `generateMetadata` is **not** changed; it keeps calling `getPublicSiteBySlug` and degrades to `"האתר לא נמצא"` for an unpublished draft. Metadata in an iframe is invisible.

**`getPublicSiteBySlug` gains an explicit websites column list**, replacing `.select("*")` at `website.service.ts:162`. Revision 1's migration comment claimed `design_draft` is "never read by `/s/[slug]`", which was simply false — `select("*")` pulls it into the public render path on every anonymous request to every storefront. It does not currently reach the browser (page.tsx destructures the row field by field and never passes it wholesale to a client component), but the comment asserted a structural guarantee that nothing enforced, and the next person to write `website={site.website}` on a client component would have turned every owner's unpublished draft into public HTML. The list is the full current column set plus `design_live` only — enumerated exhaustively from `types/database.ts:485-508`, so nothing can be accidentally omitted:

```
id, business_id, page_home, page_about, page_services, page_contact, page_faq,
page_landing, landing_settings, tracking, seo_meta, slug, published,
hero_image_url, hero_style, layout_style, social_links, generated_at,
created_at, updated_at, design_live
```
`websites` is also the last remaining `select("*")` in that function — `businesses` (`:172`), `brand_assets` (`:177`) and `whatsapp_config` (`:182`) already use explicit lists.

**Studio-mode suppression list.** In studio mode the page emits `<meta name="robots" content="noindex,nofollow" />` and does **not** render: `<SiteVisitTracker>`, `<StoreChatWidget>`, `<SitePopup>`, `<WhatsAppFloat>`, the `!waLink` fallback `.float-btn` (`fixed bottom-5 left-5 z-50`), and `<AnnouncementBar>`. Revision 1 listed only the first three; the last three are **fixed/sticky overlays that float over the preview and, at the 390px device size, directly over the drag targets**. An owner previewing their own site must also not pollute their analytics or trigger their own popup.

### E.4 The postMessage contract

Types live in `lib/studio-messages.ts` (pure, shared by both sides).

```ts
export const STUDIO_TX = "apropo-studio" as const;   // parent -> iframe
export const STUDIO_RX = "apropo-preview" as const;  // iframe -> parent

export type StudioToPreview =
  | { source: typeof STUDIO_TX; v: 1; type: "design"; design: DesignConfig | null }
  | { source: typeof STUDIO_TX; v: 1; type: "highlight"; section: SiteSectionKey | null }
  | { source: typeof STUDIO_TX; v: 1; type: "rects:request" }
  | { source: typeof STUDIO_TX; v: 1; type: "reload"; reason: string };

export type PreviewToStudio =
  | { source: typeof STUDIO_RX; v: 1; type: "ready";
      sections: SiteSectionKey[];
      /** The [data-slot] nodes that ACTUALLY exist per section, so the
       *  inspector can grey out a toggle that would do nothing (§D.2). */
      slots: Partial<Record<SiteSectionKey, string[]>> }
  | { source: typeof STUDIO_RX; v: 1; type: "rects";
      docHeight: number;
      /** left+width are REQUIRED: without them OverlayLayer cannot draw a
       *  section outline and can only guess a chip's inline position from the
       *  frame width — which is what made the overlay unimplementable in
       *  revision 1. All four values are in iframe CSS px, pre-scale. */
      rects: { key: SiteSectionKey; top: number; left: number; width: number; height: number }[] }
  | { source: typeof STUDIO_RX; v: 1; type: "select"; section: SiteSectionKey }
  | { source: typeof STUDIO_RX; v: 1; type: "error"; message: string };
```

**Origin validation on both sides. Both checks are mandatory; neither is sufficient alone.**

Parent (`components/business/studio/preview-frame.tsx`):
```ts
// Same-origin by construction (frame-ancestors 'self'), so anything from a
// different origin, a different window, or without our envelope is hostile.
function onMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return;
  if (e.source !== frameRef.current?.contentWindow) return;
  const d = e.data as PreviewToStudio | undefined;
  if (!d || d.source !== STUDIO_RX || d.v !== 1) return;
  // ... switch on d.type
}
// Sending:
frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
```

Iframe (`components/public/studio-bridge.tsx`, a client component mounted by `page.tsx` **only** when `studioBusinessId` is truthy):
```ts
function onMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return;
  if (e.source !== window.parent) return;
  const d = e.data as StudioToPreview | undefined;
  if (!d || d.source !== STUDIO_TX || d.v !== 1) return;
  // ... apply
}
window.parent.postMessage(msg, window.location.origin);
```

`window.location.origin` — never `"*"`, in either direction.

### E.5 Instant vs. reload

`StudioBridge` applies a `design` message by rewriting **one** `<style id="studio-live">` element it owns in `document.head`, using the same pure `designToCss(design, plan, ctx)` the server uses. Nothing else on the page is mutated, so there is exactly one code path for "how does a design turn into CSS".

**Two hard rules on that write, both one-liners, both required:**

```ts
const design = resolveDesignConfig(msg.design);   // 1. never trust the envelope's payload
if (!design) { styleEl.textContent = ""; return; }
styleEl.textContent = designToCss(design, plan, ctx);   // 2. textContent — NEVER innerHTML
```
1. The origin checks make this same-origin-only, so it is not remotely exploitable — but the bridge is the **one place where CSS is assembled inside the storefront document**, and that is the worst possible place to skip the validator. `resolveDesignConfig` is already pure and already imported by both sides.
2. `innerHTML` / `insertAdjacentHTML` / `document.write` are **forbidden here**. The server side is safe by construction — `<style>{designToCss(...)}</style>` is a React text child and React escapes `<`, so a `</style>` inside a value cannot terminate the element (the same pattern as `page.tsx:819` and `tier-styles.tsx`). `styleEl.innerHTML = css` throws that protection away and makes `</style><img src=x onerror=…>` in any string-typed token a live DOM XSS **on the storefront origin — the origin that also serves the dashboard**, under `frame-ancestors 'self'`.

**Instant (no reload, < 16 ms):**
- all 32 tokens
- **section order, hide/show — by real DOM moves, not CSS `order`.** See below.
- per-section align / size / slot order / slot hide
- title overrides — the bridge mutates **only the last text node** of `[data-sec="k"] [data-el="section-title"]`, never `textContent` (§D.4)
- font family — the bridge sets `rootEl.style.fontFamily`, writes a `[data-tier] h1,h2,h3` rule into its own stylesheet, and injects/updates a `<link rel="stylesheet">` for the Google family

**Reordering the preview: `parent.insertBefore(wrapperEl, refEl)` on the `[data-sec]` wrappers.**

Revision 1 specified CSS `order` on a `data-studio-flow` flex parent. That could not work, for three independent and individually fatal reasons:

1. `data-sec` was stamped conditionally on `plan.props[key]`. Dragging changes `order`, not `props`, so a section the owner only *reordered* carried no `data-sec` and the preview CSS had nothing to select. **Fixed in §D.4** — `data-sec` is now unconditional under a design or studio mode.
2. The wrapper is `className="contents"`, which risk 4 correctly makes a hard invariant. **A `display: contents` element generates no box, so `order` is ignored outright.**
3. There is no "ordered block" element to put `data-studio-flow` on. `app/s/[slug]/page.tsx:990` renders `{orderedSections}` as a **bare array of siblings** directly inside the root `<div data-tier>` (`:783`) — alongside `<header class="sticky top-0 z-50">` (`:838`), `<StoreHero>`, `<MarqueeBand>`, the floating buttons and the footer. Turning that div into a flex column would make header/hero/footer flex items at the default `order: 0`, so every section given `order: 1..12` would sink **below the footer**.

A DOM move needs no flex container, no extra wrapper element, and works correctly through `display: contents` (the element still exists in the DOM; only its box does not). Hide/show stays `display: none` on the `[data-sec]` wrapper — that *does* override `contents`, and an unlayered `[data-tier][data-design] [data-sec="x"]` rule at (0,3,0) beats Tailwind's `.contents` regardless of layering. **Preview-only**: the published page reorders on the server, so visitors never pay for any of this.

§J asserts `data-sec` is emitted for all 12 keys regardless of `props`, and the manual checklist adds: *drag every one of the 12 sections and confirm the preview DOM order matches the inspector list*.

**Requires reload (`{type:"reload"}` → `location.reload()` inside the iframe):**
- any category tree edit (create / rename / move / delete / bulk-assign) — server data, and it now happens on a different screen (§G.1)
- product add/remove/hide
- `heroStyle` / `layoutStyle` changes (they come from the AI or the מראה panel and are server-rendered through the draft overlay in §E.3), and `site_mode` changes
- publish (to prove the live render matches)

The studio shows a 400 ms skeleton shimmer over the frame during a reload so it reads as intentional.

**The preview session must not expire out from under the owner.** `maxAge` is 900s and `<DesignStudioRoot>` re-mints by calling `POST /api/studio/preview-session` on a **10-minute interval and on every `visibilitychange` to visible**, while the tab is alive; it calls the `DELETE` on unmount and on `beforeunload`. Additionally `preview-frame.tsx` starts an **8-second `ready` timeout after every load and reload**; if `ready` never arrives — which is exactly what happens when the cookie has lapsed, because `<StudioBridge>` never mounts on a `notFound()` and therefore never speaks — the pane covers the frame with a Hebrew reconnect card: **"התחברנו מחדש לתצוגה"** + a retry button that re-mints and reloads. Revision 1 set a 30-minute cookie with no refresh and a manual-test line referring to a "reconnect card" that was specified nowhere; the real behaviour was a bare 404 inside the preview pane with the parent learning nothing.

**One thing the bridge must handle that is easy to miss:** `components/public/site-effects.tsx` hides `[data-reveal]` blocks until an IntersectionObserver fires. In a scaled, reordered iframe some sections may never intersect. `StudioBridge` therefore adds `html.js-reveal [data-reveal]{opacity:1;transform:none}` to its own stylesheet on `ready`, permanently revealing everything in preview. Without this the owner drags a section up and it appears blank.

### E.6 CSP / frame-ancestors

**No change to `next.config.ts` is required.** Verified:
- `frame-ancestors 'self'` (`next.config.ts:53`) — the embedder is the same origin ✅
- `X-Frame-Options: SAMEORIGIN` (`:69`) ✅
- `frame-src 'self' …` (`:48`) — the *embedder's* directive already allows `'self'` ✅
- `style-src … 'unsafe-inline'` (`:40`) — the injected `<style id="studio-live">` is not blocked ✅
- Headers are applied to `/:path*` (`:95-97`), so both sides get them ✅
- `postMessage` is not governed by `connect-src`; nothing to add ✅

**Standing rule, in the same voice as 0085's, that this section must carry.** `frame-ancestors 'self'` means the storefront origin and the dashboard origin **are the same origin**. `/s/<any-customer-slug>` can frame `/businesses/<id>/studio` and read it same-origin, and the studio now publishes a documented postMessage control protocol there. Today there is no injection sink to reach it — the only `dangerouslySetInnerHTML` under `/s` are `safeJsonLd` calls (`page.tsx:278`, `:800`, `:805`; `product/[productId]/page.tsx:171`; `blog/[postId]/page.tsx:121`), and no pixel/GTM injection code exists anywhere in `app/`, `components/` or `lib/` despite `next.config.ts:10-13` describing it as shipped. So this is latent, not live. But `script-src` carries `'unsafe-inline'` **and** `'unsafe-eval'` (`next.config.ts:39`), so:

> **No owner-supplied HTML or JS may ever be rendered under `/s` on this origin.** Shipping the pixel/GTM feature anticipated at `next.config.ts:10-13` requires moving storefronts to a **separate origin first** — at which point the second `headers()` entry below becomes mandatory rather than conditional on custom domains. Do not reach for an iframe `sandbox` attribute as a substitute: an `allow-same-origin` sandbox buys nothing here, and without `allow-same-origin` the bridge cannot function at all.

**If custom domains ever ship for storefronts** (`custom_domain` exists today only as an unsold SKU at `lib/plans.ts:209`), the preview breaks. The fix is a **second** `headers()` entry scoped to `/s/:path*` placed **after** the global one — Next's rule is that the last matching entry wins for the same key. In that entry, `frame-ancestors` becomes the explicit dashboard origin and `X-Frame-Options` must be **removed**, not modified, because `ALLOW-FROM` is dead in every modern browser. Written here so nobody rediscovers it.

---

## F. Editor UX

### F.1 Route + shell

New nav key `studio` → route folder `app/(dashboard)/businesses/[businessId]/studio/`. The folder name **must** equal the key: `components/shared/business-nav.tsx:97` derives `href` as `` `${base}/${item.key}` `` and `:98` matches with `pathname.startsWith(href)`. `studio` is not a prefix of any existing key, so no double-highlight.

Nav label: **אולפן עיצוב**, icon `Sparkles` (lucide), placed immediately after `website` in `ITEMS`. Visible in all three modes (`modeAllowsNav` is allow-by-default), so **no `hiddenNav` entry and therefore no `assertNavAllowed` call** — but the page still calls `getBusiness` + `notFound()`.

```ts
export const metadata = { title: "אולפן עיצוב" };
// The design agent runs as a route handler (300s), but the publish/preset
// server actions on this page can still take ~20s under a cold Supabase
// connection. 180 matches the sibling website screen.
export const maxDuration = 180;
```

**Gating**, mirroring `website/page.tsx:56-58`:
```
!assets?.generated_at  -> <BrandingWatcher/>      (reuse, unchanged)
!website?.generated_at -> <WebsiteWatcher/>       (reuse, unchanged)
!website.design_generated_at -> <DesignWatcher/>  (new; fires the design agent)
```
So the studio can assume branding + website content + a generated design all exist.

### F.2 Desktop layout (≥1024px)

The dashboard shell is `max-w-6xl px-4` with a `grid md:grid-cols-[200px_1fr]` sidebar. The studio does **not** break out of it; instead it splits the `1fr` column:

```
grid lg:grid-cols-[1fr_320px] gap-4        ← RTL: preview on the RIGHT, inspector on the LEFT
```

**Right (preview), ~600px of shell width.** A `PreviewFrame` that renders the iframe at a fixed CSS width (desktop 1280 / tablet 768 / mobile 390) inside an `overflow-hidden` box, scaled with `transform: scale(s); transform-origin: top right` where `s = boxWidth / frameWidth`, clamped to `[0.35, 1]`. `transform-origin` is `top right` because the document is `dir="rtl"`. Above the frame: a device toggle (3 icon buttons), a zoom readout (`72%`), a ⟳ reload button, and a "פתחו בכרטיסייה חדשה" link.

**Left (inspector), 320px.** A vertical `Tabs` (`dir="rtl"`) with **6** panels — מראה · מקטעים · צבעים · צורות · טיפוגרפיה · קצב ותנועה. **The order is deliberate and changed from revision 1**: §F.1 guarantees an AI design was just composed, and §A's owner arrives because *the look* is wrong. Landing on a list of 12 section rows with grips — three of which had no comprehensible name — was the least legible possible first screen after a 35-second progress card.

| tab | contents |
|---|---|
| **מראה** *(default)* | **סגנונות מוכנים**: a row of 6 complete looks (full token set + section order), plus up to 3 AI variants from `design_draft.history` (§H.5) as chips on the same row. Below it the agent's design **name + rationale**, then the four controls that actually change how a site feels: `surfaceBase`, `accent`, `headingFont`, `radiusCard`. Then **נסו מראה אחר** with the remaining hourly AI budget shown from the first click. |
| **מקטעים** | The section list — sortable, one row per `SiteSectionKey` with a grip, `SECTION_LABELS[key].label` as the title and `.hint` as the subtitle, an eye toggle, and a ⌄ that expands size / align (where `ALIGN_CAPABLE`) / slot order / title override / benefit icons. Each row also carries a **ערכו טקסטים** link that deep-links to the website screen's תוכן tab for that section. |
| **צבעים** | the remaining 6 colour swatches + `hairlineStrength` + a live contrast panel. |
| **צורות** | `radiusButton`, `borderWidth`, `shadowDepth`, plus 4 named radius presets (חד / רך / מעוגל / גלולה). |
| **טיפוגרפיה** | `bodyFont`, `headingWeight`, `headingSize`, `headingTracking`, `titleGap` (2 font selects, each option rendered in its own family). |
| **קצב ותנועה** | `sectionRhythm`, `gridColumns`, `motionSpeed`, `headerOpacity`, hero controls — and, behind a **מתקדם** accordion collapsed by default, the 14 designer-grade knobs: `contentWidth`, `headerBlur`, `ctaBandStrength`, `revealDistance`, `borderWidth`, `hairlineStrength`, `titleGap`, `buttonPaddingX/Y`, `headingTracking`, `surfaceRaised`, `surfacePanel`, `heroOverlay`, `--t-btn-weight`. |

**There is no 7th קטגוריות tab.** Category editing is not in the studio — see §F.2's safety note below and §G.1.

The **מתקדם** accordion on desktop mirrors what §F.7 already does on mobile. 32 tokens is simultaneously too many for a clothing seller in Petah Tikva and too few to change a site's whole feel; the answer to both halves is presets first, primary controls second, professional knobs folded away. **Hero imagery** — the one lever that changes a site's feel more than any token — is not duplicated here: the מראה panel carries a **החליפו תמונת Hero** button that deep-links to the existing logo+hero studio (`components/business/design-studio.tsx`) on the website screen.

The 6 shipped presets are all dark-ground, plus exactly one labelled **"בהיר (ניסיוני)"** carrying risk 9's warning inline. Light grounds remain flagged, not silently offered as equal (~30 unremapped `hover:` utilities; fixing them is a separate project).

**Nothing in this screen except פרסום העיצוב changes the live site.** That statement is now true, which it was not in revision 1: the קטגוריות tab sat under the same publish bar while every action inside it — `assignProductsToCategoryAction` revalidating `/s/{slug}`, a rename firing the `sync_category_rename` trigger over live products, a delete nulling `category_id` on live rows — committed to production immediately. A non-technical owner would have renamed and deleted categories believing it was all a draft. The manager now lives only on the חנות screen, with its own live-write banner (§G.1), and the studio links out to it.

Above the tabs, always visible: the **↶ ביטול / ↷ חזרה** pair.
Below the tabs, sticky: the `שמור אוטומטית ✓ נשמר` status, the primary **פרסום העיצוב** button, and the permanent one-line footer **"כל שינוי שתעשו כאן נשאר מושלם גם בנייד — אנחנו לא נותנים לכם לשבור את האתר."** (§A).

**Overlay drag on the real site.** `OverlayLayer` renders, per section, a **full outline** at `rect × scale` plus a chip anchored **inside** the outline's top-inline-start with a **solid backplate**. Both the outline and the backplate are required: revision 1 shipped only "a small pill at the section's top-inline-start", which in RTL is the top-**right** — exactly where the storefront's own `<header data-el="chrome-header" className="sticky top-0 z-50 …">` sits (`page.tsx:834`) and where the scroll gutter lives. A bare chip there overlaps real site chrome and the owner cannot tell what belongs to the editor. This is also why `rects` now carries `left` and `width` (§E.4) — without them the chip's inline position is a guess and the outline cannot be drawn at all.

Drag mechanics (dnd-kit, the `leads-board.tsx` pattern, **not** `sortable`, because the items are absolutely positioned):
- `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` — identical to all three existing dnd-kit sites; the 5px threshold keeps a plain click on a chip meaning "select this section".
- Each chip is both `useDraggable` and `useDroppable`. Dropping A onto B applies `arrayMove(order, idxA, idxB)`.
- `CSS.Translate.toString(transform)` — deltas are physical pixels, which is correct for a purely **vertical** axis. **No RTL flip is needed and none must be added**; the existing `modules-picker` never exercises the horizontal axis either. If a horizontal drag is ever added, it needs an explicit modifier.
- **Drags are never blocked by an in-flight save.** Revision 1 copied `if (saving) return;` from `modules-picker.tsx:139` — but that precedent is a click-toggle list, and this is direct manipulation. With a 700 ms trailing debounce plus a server action §F.1 itself budgets at ~20s on a cold Supabase connection, an owner would drag, see nothing move, drag again, see nothing move, with the status line saying only `שומר…`. Instead: apply the drag to local state and the preview **immediately**, keep **one** request in flight, and if a save is already running, **replace the queued snapshot** rather than dropping the gesture. The full-snapshot write model makes this safe — out-of-order commits are prevented by having at most one request outstanding, not by refusing user input. The identity-guarded revert on error is unchanged.
- The chip components (`SectionChip`, `SectionRow`) are **module-level** components. `react-hooks/static-components` is an **error** in this repo — defining them inside the studio component fails lint.

### F.3 Keyboard operation (requirement 5)

The repo has **no `KeyboardSensor` anywhere** and dnd-kit's default announcements are English inside an all-Hebrew UI. We do not adopt them. Instead:

- Every section chip **and** every inspector row is a real `<button>` in the tab order, with `aria-label={`${label} — מקטע ${i + 1} מתוך ${n}`}` and `aria-roledescription="פריט הניתן לסידור"`.
- With a row focused: `ArrowUp` / `ArrowDown` move the section one place (the list is vertical, so RTL does not flip anything); `Home` / `End` move to the ends; `Space` toggles visibility; `Enter` expands the row's detail panel.
- A single `<div aria-live="polite" className="sr-only">` in the inspector announces, in Hebrew: `"מקטע החנות הועבר למקום 2 מתוך 9 גלויים"`. **The denominator counts VISIBLE sections, and the string says so.** Revision 1 announced "מתוך 12" while the inspector list hides sections the owner switched off, so the announced number would not have matched what anyone — screen-reader user or not — could see.
- Focus rings are never removed. The studio uses the app's `focus-visible:ring-3 focus-visible:ring-ring/50` convention (as in `components/ui/switch.tsx`); the overlay chips additionally get a 2px white outline with a 2px dark offset so they are visible over any preview background.
- Every colour input is a native `<input type="color">` (the existing precedent, `branding-editor.tsx:123-128`) **paired** with a hex `<Input dir="ltr" className="font-mono">`, because a native colour swatch alone is not keyboard-enterable with a precise value.
- Every slider is the new `components/ui/slider.tsx` wrapper over `@base-ui/react/slider`, which is arrow-key operable, **paired** with a `<NumberField>`-style numeric input for exact entry.
- **Base UI direction caveat:** no `DirectionProvider` is mounted anywhere in this repo, and Base UI's default is `ltr` (`node_modules/@base-ui/react/esm/direction-provider/DirectionProvider.js:14`). A `Slider`'s arrow-key semantics would therefore be LTR-ish. The studio mounts `<DirectionProvider direction="rtl">` **inside the studio subtree only** (not app-wide — app-wide is a separate, riskier change that would alter arrow-key behaviour on every existing Base UI component). This is a one-line addition in the studio's client root and is called out as such.

### F.4 Undo / reset

- **↶ ביטול / ↷ חזרה** — a **persisted** ring of up to 20 `{ tokens, sections }` snapshots at `design_draft.undo`, pushed on every committed change (not on every slider tick — the debounce coalesces), plus a redo pointer. `Ctrl+Z` and `Ctrl+Shift+Z` / `Ctrl+Y` bound in the studio root; **both buttons also appear in the mobile sticky bottom bar** (§F.7).

  Revision 1 kept 50 snapshots in memory with no redo and stated "a reload starts clean". That is the single combination that makes non-technical owners stop pressing undo at all: §F.5 autosaves the draft on a 700 ms debounce and §E.5 reloads the *iframe* on six separate events, so after any full-page reload the draft still held all 30 changes while the undo stack held zero — leaving only the two nuclear buttons, i.e. throw away everything to undo one slider. And undo without redo is the reason people never press undo in the first place.

  The ring lives in the same jsonb that §H.5 already uses for the 3 AI variants (`design_draft.history`), under a **sibling** key so the two never collide. Bound explicitly: entries are dropped oldest-first until `JSON.stringify(design_draft).length < 64_000`. `resolveDesignConfig` ignores both `undo` and `history` — they are not `tokens` and not `sections`, and §J asserts neither ever reaches `designToCss`.
- **איפוס לשינויים שפורסמו** — copies `design_live` back into `design_draft`. Confirmation dialog.
- **חזרה לעיצוב המקורי** — sets `design_draft = {}`. The preview immediately renders exactly what the site looked like before the studio existed. This is also the owner-facing proof of the zero-change guarantee, and it is the first thing to demo.

### F.5 Save model

**Draft: autosave. Live: explicit.**

- Every change updates local state immediately and posts to the iframe immediately (0 ms perceived latency).
- A 700 ms trailing debounce calls `saveDesignDraftAction(businessId, design)`.
- Optimistic write with the `modules-picker` discipline: keep the previous value, and on error `toast.error(res.error)` + `setDesign((cur) => (cur === next ? prev : cur))` — the identity guard so a newer edit is not clobbered by a stale revert.
- A save in flight never blocks anything — see the single-in-flight, last-write-wins queue in §F.2. Slider changes coalesce into the next debounce window.
- Status line: `שומר…` → `נשמר ✓` → (on error) `לא נשמר — נסו שוב`.

**Publish.** `publishDesignAction(businessId)`:
1. `requireUser()`
2. `getBusiness(businessId)` → `{ error: "העסק לא נמצא" }`
3. **owner/admin check** — see the note below
4. read `websites.design_draft`, `resolveDesignConfig` it, run `autoCorrectContrast` unconditionally
5. `upsertWebsite(businessId, { design_live: corrected, design_draft: corrected, ...(chrome.heroStyle ? { hero_style } : {}), ...(chrome.layoutStyle ? { layout_style } : {}) })` — the draft is normalised to the corrected value so the studio and the live site cannot disagree, and the AI's `heroStyle` / `layoutStyle` picks are applied to the real columns **here and only here** (§H.2), which is what keeps them inside the draft-and-publish story
6. `revalidatePath('/businesses/{id}/studio')`, `revalidatePath('/businesses/{id}/website')`, `revalidatePath('/s/{slug}')`
   *(Deliberately not `/branding` — that path is a `redirect()` stub since the merge, and `design.ts:20` still hitting it is a known-stale wart we do not copy.)*
7. return `{ corrected: number }` so the UI can say `"פורסם ✓ התאמנו 2 צבעים כדי שהטקסט יישאר קריא"`

**Publish is owner/admin-only — an explicit decision, not an accident of `getBusiness`'s semantics.** `getBusiness` uses the RLS client (`lib/services/business.service.ts:35-46`) and `0067_business_members.sql:115-120` added `businesses_select_member`, so that lookup succeeds for **any active member regardless of role** — a staff account could repaint a customer's live storefront. The repo already distinguishes this case (`is_business_owner_or_admin`, `0067:67-70`). Step 3 mirrors it in TypeScript against `business_members` on the RLS client rather than calling the SQL helper, because `0085:124` revoked its EXECUTE from `public` and `anon`. Staff keep full access to everything else in the studio, including the draft — they simply cannot publish. Note that the `store_categories` RLS policy is member-inclusive by design and stays that way; that is consistent with the rest of the repo.

The publish button opens a confirm dialog first: **"לפרסם את העיצוב? האתר החי ישתנה מיד."** — containing a **plain-Hebrew change list diffed from `design_draft` vs `design_live`**: *"שיניתם 6 צבעים, גופן כותרות, וסדר של 3 מקטעים"*, plus the count of contrast auto-corrections step 4 already returns. Revision 1 promised "a side-by-side thumbnail of live vs. draft", which nothing in this stack can render: there is no screenshot service, Playwright is a §K non-goal, `html2canvas` cannot capture the published state, and a second iframe would not help because the cookie's `path: "/s"` (§E.2) means **both** frames send it and both render the draft. It would have been discovered during P7 and quietly dropped, leaving the highest-stakes dialog in the product empty. A text diff is also more actionable than two 25%-scale screenshots an owner cannot read.

**This is the only control in the entire studio that changes the live site** — and, with the categories tab removed (§F.2), that is now literally true.

If `websites.published === false`, the publish button is replaced by a note pointing at the publish card on the website screen: *"האתר עדיין לא פורסם — העיצוב יישמר וייכנס לתוקף ברגע שתפרסמו את האתר."* The design is still written to `design_live`; it simply has no public reader yet.

### F.6 What the studio shows in each site mode (requirement 4)

| | **website** (אתר תדמית) | **landing** (דף נחיתה) | **store** (חנות) |
|---|---|---|---|
| Preview | full storefront, `data-tier` present | the landing page — **no `data-tier`, no `TierStyles`, no `ThemeStyle`** | full storefront + products |
| מראה tab | full | **2 controls only**: `headingFont`, `bodyFont`. Presets are shown as font pairings only. | full |
| מקטעים tab | all 12 keys | **hidden.** Landing's 11 sections are hard-coded in `components/public/landing-page.tsx` and it never touches `sectionByKey`. Replaced by a read-only card: *"בדף נחיתה סדר המקטעים קבוע — הוא מותאם להמרה."* | all 12 keys, `store` pinned to the top of the list by default |
| צבעים / צורות / קצב | full | **all disabled**, with *"זמין באתר תדמית ובחנות"* | full |
| טיפוגרפיה | full | `headingFont` + `bodyFont` only; weight/size/tracking/gap disabled | full |
| `contentWidth` | enabled only when `layout.hints.condensed` (§C.2) | disabled | same as website |
| `gridColumns` | disabled (no product grid) | disabled | enabled |
| קטגוריות | not in the studio (§F.2) — link to the חנות screen | n/a | not in the studio — link to the חנות screen |
| Publish | same | same | same |

**Revision 1's landing claim was wrong and is corrected here.** It promised landing "the 4 tokens that reach it: `headingFont`, `bodyFont`, `radiusButton`, `buttonWeight`". `radiusButton` and `buttonWeight` are consumed **only** by `professionalCss:467`/`:470` under `[data-tier="professional"] [data-el="btn-primary"]`; `components/public/landing-page.tsx` contains **zero** `data-el` hooks, and the landing branch (`page.tsx:268-315`) renders no `data-tier` and no `<TierStyles>`. They cannot reach landing without new markup and a separately scoped rule set, which is out of scope.

What *does* reach landing is exactly the two font tokens — and only because §C.2 moved fonts off the CSS-var mechanism onto server-side resolution: `page.tsx:274` is the landing branch's own `style={bodyFont ? …}`, and `:298` is its own `h1,h2,h3` rule inside its own `<style>`. Both take `effectiveBodyFont` / `effectiveHeadingFont` the same way the storefront branch does.

Consequently **no `ThemeStyle` and no `data-design` are emitted for landing at all**, and revision 1's paragraph about scoping a landing token block and running `auditContrast` against white grounds is **deleted** — with no colour tokens reaching landing there is nothing to audit. `lib/site-design.ts` still takes the ground set as a parameter (it is the right shape), but landing does not use it in v1. Landing's brand stays the raw `pickBrandColor`, not `brandForDarkGround` (`page.tsx:231-233`); the studio must not "fix" that.

### F.7 Mobile (< 768px) — requirement 6

`useIsMobile()` already exists (`hooks/use-mobile.ts`). Below 768px the studio becomes a **single-column, two-mode screen**:

- A top segmented control: **תצוגה** | **עריכה**. One is visible at a time; the preview is never squeezed into a 40%-width sliver.
- **תצוגה** renders the iframe at 390px CSS width, `scale(1)` — no scaling math, no overlay chips, tap-to-select only. Tapping a section switches to **עריכה** with that section's row already expanded. Full-height, with the save/publish bar pinned to the bottom (`sticky bottom-0`, 56px, safe-area padded).
- **עריכה** renders the inspector full-width. Tabs become a horizontally scrollable strip. Each token group is a `Collapsible` (Base UI `accordion`, newly wrapped), collapsed by default, so the owner scrolls a short list rather than a wall of sliders.
- **Section reordering on mobile does NOT use drag.** Long-press-vs-scroll on a touch device is genuinely ambiguous and this repo's only drag config is `PointerSensor` with a 5px threshold, which fights scrolling. Instead each section row gets large **▲ / ▼** buttons (44×44 CSS px) plus a "העבירו למקום…" number field. This is faster than dragging on a phone, and it is the same code path the keyboard uses.
- Sliders get 44px-tall touch targets and the paired numeric input is `inputMode="decimal"`.
- The overlay layer, the device switcher and the zoom control are **not rendered** at all below 768px.
- **↶ / ↷ are in the sticky bottom bar**, next to the publish button. `Ctrl+Z` does not exist on a phone, and undo matters *more* on a device where mis-taps are the norm — it is more important there than the device switcher this section correctly drops.

Between 768px and 1024px (tablet): the split pane appears but stacked vertically — preview on top (fixed 420px tall, scaled), inspector below. Overlay chips are enabled; drag works.

---

## G. Categories

### G.1 Manager UI — `components/business/category-manager.tsx`

**Mounted in exactly one place: a card on `app/(dashboard)/businesses/[businessId]/store/page.tsx`.** Not in the studio.

Revision 1 put it in a sixth studio tab, under the same publish bar, next to five tabs where nothing commits until פרסום. But **every action in it writes to production the moment it is saved**: `assignProductsToCategoryAction` revalidates `/s/{slug}`, a rename fires the `sync_category_rename` trigger which rewrites `products.category` for live products, a delete nulls `category_id` on live rows. A non-technical owner would have renamed and deleted categories believing it was all a draft — and §A's own story had Dana renaming a category "in the same breath as dragging sliders, then pressing publish", which was the spec's own counter-example to its own safety claim.

Keeping the studio to a single, true safety model is worth more than tab adjacency. The studio's מקטעים row for `store` carries a **נהלו קטגוריות** link to the חנות screen, and the manager card itself carries a permanent, visually distinct Hebrew banner:

> **שינויי קטגוריות נשמרים מיד ומשפיעים על האתר החי.**

Rename, delete and bulk-assign additionally each get their own confirm step.

- A two-level sortable tree. Roots are a vertical `SortableContext`; each root's children are their own nested `SortableContext`. Both use `PointerSensor { distance: 5 }` + `verticalListSortingStrategy` + `arrayMove`, and both persist a **full snapshot** normalised to contiguous `sort` values server-side — copied verbatim from `lib/actions/modules.ts:62-86`.
- Row: grip · name (inline-editable on click) · product count badge · eye (visible) · ⋯ menu (הוספת תת-קטגוריה / העברה / מחיקה).
- Depth is capped at 2. Dropping a root onto another root's child zone converts it to a child **only if it has no children of its own**; otherwise a Hebrew toast: *"אי אפשר להכניס קטגוריה שיש לה תתי-קטגוריות"*.
- **Delete** opens a dialog naming the exact consequence: *"מחיקת «חולצות» תסיר את השיוך מ-11 מוצרים. המוצרים עצמם יישארו."* — and, for a parent, *"וגם תמחק 3 תתי-קטגוריות."* Products are never deleted (`on delete set null (category_id)`).
- **Empty state:** *"עדיין אין קטגוריות"* + two buttons: **הוסיפו קטגוריה** and **הציעו לי קטגוריות (AI)** — the latter runs the `store_categories` agent (§H).

### G.2 Bulk assignment

A **שיוך מוצרים** panel inside the manager: a virtualised checkbox list of all the business's products (name + thumbnail + current category), a search box, "בחרו הכל / נקו", and a category `<Select>` + **שייכו** button.

`assignProductsToCategoryAction(businessId, productIds: string[], categoryId: string | null)`:
- `requireUser()`; `getBusiness(businessId)` or `{ error: "העסק לא נמצא" }`
- cap `productIds.length <= 500` → `{ error: "יותר מדי מוצרים בבקשה אחת" }`
- **explicitly verifies the category belongs to the business** before writing. The composite FK already makes a cross-tenant write impossible at the DB level, but the action returns a Hebrew error instead of a raw Postgres FK violation.
- writes with `.update({ category_id }).eq("business_id", businessId).in("id", productIds)` — note the `business_id` predicate. `lib/services/store.service.ts:70-83` (`updateProduct`/`deleteProduct`) filter by `id` alone and lean entirely on RLS; **do not copy that**. A new `assignProducts` helper in `lib/services/store-categories.service.ts` filters on both.
- `revalidatePath('/businesses/{id}/store')`, `'/businesses/{id}/studio'`, `'/s/{slug}'`

**The same discipline is mandatory for every other category action, not just this one.** Revision 1 listed `createCategoryAction`, `renameCategoryAction`, `moveCategoryAction`, `reorderCategoriesAction` and `deleteCategoryAction` **by name only**, with no auth story — while simultaneously revoking DELETE from the RLS client, which would have made `deleteCategory` fail with `42501` on its first run and put `createServiceRoleClient()` in front of the implementer as the fastest fix. A service-role `.delete().eq("id", categoryId)` is a **cross-tenant delete**: any authenticated user could pass another business's category uuid, and via `on delete set null (category_id)` plus the parent cascade it would un-assign the victim's products and wipe their subtree. §B.1 therefore does **not** revoke DELETE (the RLS `for all` policy already covers it, and unlike `websites.published` this table has no privileged column), and every one of the six actions must:

1. `await requireUser()`
2. `if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" }`
3. run on `createClient()` (RLS) — **no service-role path anywhere in `store-categories.service.ts` except `getPublicCategoryTree`**
4. filter on **both** predicates: `.eq("business_id", businessId).eq("id", id)`

`moveCategoryAction` has one extra obligation: it must **load the target parent through the RLS client and reject a null result** with a Hebrew error, exactly as `assignProductsToCategoryAction` does for the category. The composite parent FK added in §B.1 makes a cross-tenant parent impossible at the DB level, but the action must not surface a raw FK violation — and the studio UI is a first-class vector, not just raw PostgREST.

Also: `components/business/store-manager.tsx`'s create form replaces the free-text `<Input name="category">` (`:198`) and `<Input name="subcategory">` (`:214`) with a single `<Select name="category_id">` listing the tree (children indented), plus a `— ללא קטגוריה —` option and a `+ קטגוריה חדשה` option that opens an inline field. `lib/actions/store.ts`'s `saveProductAction` gains a `category_id` read; the free-text `category`/`subcategory` parse is **kept as a fallback** for the CSV path, which still accepts text and now runs it through `resolveOrCreateCategory(businessId, categoryText, subcategoryText)`. That closes the third writer (`app/api/businesses/[businessId]/products/ai-generate/route.ts:99`) the same way — one helper, three callers.

### G.3 Storefront: the sidebar

`components/public/category-rail.tsx` (new) + a change to `components/public/public-store.tsx`.

**Desktop (≥1024px):** the store section becomes `lg:grid lg:grid-cols-[220px_1fr] lg:gap-8` with the rail in the **first** grid column, which in RTL is the **right** side — the natural place for a category menu in Hebrew. The rail is `lg:sticky lg:top-24 lg:self-start` **plus `lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-contain`**, and **non-active roots are collapsed by default**. Without both, 3 roots + 12 expanded children (~600px) plus the 96px top offset overflow a 768px-tall laptop viewport and the bottom categories become unreachable while the rail is stuck. Each root is a button; children render as an indented sub-list under the active root, animated with a `grid-template-rows` transition (no JS height math). An "הכל" entry sits on top with the total count. Counts come from the server, not from the rendered array.

**Tablet / mobile (<1024px): two cases, and the split is the point.**

- **A one-level tree (no root has children)** → the **existing horizontal chip row, verbatim** — the same pill buttons at `public-store.tsx:389-420` with the same `inkOn(brand)` / `CHIP_HAIRLINE` styling and the same `mb-8 flex flex-wrap justify-center gap-2` container. This is the byte-identical path, and it covers **every store that exists today**, because §B.1's backfill creates roots only.
- **Any root has children** → a single sticky full-width button — **קטגוריות · 15** — that opens a **bottom sheet** containing the real tree: collapsible roots, 44px rows, product counts, one tap to filter.

Revision 1 reused the flat chip row for both and added "children of the active root as a second chip row underneath". At 375px, with the section's `px-4` leaving ~343px, `הכל` + `חולצות` + `מכנסיים` + `הלבשה תחתונה` already wraps to two lines; tapping a root spills up to 6 more Hebrew pills across two or three further wrapping lines — roughly five ragged lines and ~190px of chips before a single product is visible. `justify-center` centres each line independently, so the child row does not visually attach to the parent chip that spawned it: no indentation, no connector, no containment, and in RTL the reading order jumps line to line. The owner asked for a sidebar and would have got an unstructured blob. The bottom sheet is one tap, zero wrapping, scales to any tree size, and is the pattern every Israeli shopper already knows from Terminal X / Castro.

**The `.limit(24)` decision — changed from revision 1.** `lib/services/website.service.ts:191` caps products at 24 with `.order("sort_order", { ascending: true })`.

**`getPublicSiteBySlug`'s limit and ordering are NOT changed by this project.** Revision 1 raised it to 60 and added a `created_at` tiebreak inside P5, while §G.3 openly admitted why the tiebreak was needed — `sort_order` is written by nothing but the seed script, so real products all sit at 0 and their order is **arbitrary per request**. That produced two unreconcilable problems: adding the tiebreak is itself a visible live change to rendered product order with an empty design config, so P6's "parity run must be clean for all 9 published sites" could not hold; and the P0 harness would have been non-deterministic on the *before* side, making a dirty diff indistinguishable from a real regression. It would also have added chips (via `public-store.tsx:284-287`, which derives the chip list from `products`) for any store that ever exceeds 24 products.

The rail does not need the `products` array at all:
- The tree and its counts come from a **dedicated, uncapped service-role query** — `getPublicCategoryTree(businessId)` in `lib/services/store-categories.service.ts` — returning `{ id, name, parent_id, sort, visible, productCount }[]` from `store_categories` left-joined to a `count(products)` grouped subquery over `active = true` products.
- If a category's `productCount` exceeds what the page loaded, the rail's count is still correct; v1 filters the loaded set client-side and shows `"מציג 24 מתוך 41"` with a **הצג הכל** link that sets `?cat=` (the page is already dynamic and can read it). Honest, and no lie in the UI.
- `getDraftSiteByBusinessId` uses `.limit(200)` (§E.3), which is a **separate function with no public reader** and therefore no parity exposure.

The arbitrary product ordering is recorded as a **known pre-existing bug** in §K's non-goals rather than fixed in passing — fixing it is a one-line change that should land as its own deliberate, announced release, not inside a design-studio package.

**Products with no category.** Today, a business with zero categorised products renders **nothing** — no chip row, no card subtitle, no breadcrumb crumb (`public-store.tsx:390`, `:240`, `product/[productId]/page.tsx:217`). The rail must reproduce that exactly:
- `tree.length === 0` → `<CategoryRail>` returns `null` and the grid collapses back to a single column. **Not** an empty rail, **not** a "ללא קטגוריה" stub.
- When categories exist but some products have none, those products appear only under **הכל**. A `— ללא קטגוריה —` entry appears in the rail **only** if uncategorised products exist *and* at least one category exists, and it is placed last.

**`app/s/[slug]/product/[productId]/page.tsx` is deliberately not changed.** Its category breadcrumb stays an inert `<span>`, and its two-step resolution (`site.products` then `getPublicProductById`) keeps working because both paths still carry `products.category`. Making the crumb a link is a v2 item (§K).

---

## H. AI generation

### H.1 Where it runs

`POST /api/businesses/[businessId]/design-system/generate` — a **route handler**, not a server action.

```ts
export const maxDuration = 300;   // matches app/api/businesses/[businessId]/design/generate/route.ts:7
```

**The guard chain is part of the spec, not left to the pattern file.** Revision 1 specified only `maxDuration` for both new routes. The file it cited as the pattern gets ownership only *indirectly* — `app/api/businesses/[businessId]/design/generate/route.ts:13-14` does `getUser()` + 401 and then hands the raw URL `businessId` to `runSiteDesignJob`, which calls `getBusiness(businessId)` on the RLS client (`lib/jobs/handlers/site-design.ts:26`) — so at the route layer it *appears* to check nothing. It also gets a concurrency guard for free from `getLatestJob(businessId, "site_design")?.status === "running"` (`site-design.ts:29-30`), and §H.1 deliberately removes the job row, which removes that guard with nothing replacing it. Both routes therefore begin with:

```ts
const user = await getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { businessId } = await params;
if (!(await getBusiness(businessId)))                       // RLS client — the real ownership check
  return NextResponse.json({ error: "העסק לא נמצא" }, { status: 404 });
if (!(await checkRateLimit(`design_system:${businessId}`, 10, 3600)))
  return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
if (!(await checkRateLimit(`design_system_lock:${businessId}`, 1, 60)))
  return NextResponse.json({ error: "בקשה קודמת עדיין רצה — נסו בעוד רגע" }, { status: 429 });
```

The second `checkRateLimit` is the in-flight lock that replaces the job row. Without the whole chain, any authenticated user could loop the endpoint for unbounded concurrent 35-second Gemini calls at `HEAVY_CAP = 8000` output tokens, and — if ownership were omitted, which the spec's silence invited — `POST /api/businesses/<victim-id>/store-categories/suggest` would write `store_categories` rows into a victim's account and `/design-system/generate` would overwrite their `design_draft`. Every comparable AI route in this repo already rate-limits: `ceo-chat/route.ts:31`, `whatsapp/chat/route.ts:42`, `store-chat/route.ts:95`. `checkRateLimit` is fail-open by design (`lib/rate-limit.ts:24`), which is the right trade here.

Rationale for a route handler over chaining into `runWebsiteJob`: `website` on Gemini already peaks at **44.3s**, and the route declares `maxDuration = 120`. Adding a ~35s design step gives ~80s — under the cap but with thin margin, and it would blow straight past 120s if the Anthropic fallback ever revives (`website` measured 111.5s in the Anthropic era). Chaining also means **every new business pays for a design system whether or not its owner ever opens the studio**. So: **the pipeline is not touched at all.** `lib/jobs/handlers/website.ts` is not edited by this project.

Invocation points:
1. `<DesignWatcher>` fires it on first studio open when `websites.design_generated_at is null` — the same fire-on-mount + rotating-Hebrew-steps pattern as `components/business/website-watcher.tsx`, minus `useJobWatcher` (there is no job row; the route returns the result directly).
2. The **נסו מראה אחר** button, with `{ variant: n }` in the body.
3. The categories empty state calls the sibling `POST /api/businesses/[businessId]/store-categories/suggest` (same file pattern, `maxDuration = 300`).

Both write to `design_draft` / `store_categories` **only**. Neither ever writes `design_live`. Generation cannot change a live site.

No new `job_type` enum value, therefore **no enum migration** and no `types/database.ts` `JobType` edit. That was the alternative and it was rejected: a synchronous 35s call the owner is watching does not need an audit row, and adding an enum value carries the Postgres rule that the new value cannot be *used* in the same transaction that adds it.

### H.2 Schema — `lib/ai/schemas/design-system.ts`

```ts
import { z } from "zod";

/** Google Fonts families verified to ship Hebrew glyphs. A non-Hebrew family
 *  on an RTL site silently falls back and destroys the design, and
 *  fontsHref() (app/s/[slug]/page.tsx:85-95) tests families with /^[\w\s-]+$/,
 *  an ASCII-only regex — so these are also all safe to put in that URL. */
export const HEBREW_FONTS = [
  "Heebo", "Rubik", "Assistant", "Alef", "Varela Round", "Secular One",
  "Suez One", "Frank Ruhl Libre", "David Libre", "Miriam Libre", "Bellefair",
  "Karantina", "Noto Sans Hebrew", "Noto Serif Hebrew",
] as const;

export const SECTION_KEYS = [
  "benefits", "about", "services", "store", "booking", "faq",
  "orderTracking", "rentals", "modules", "reviews", "band", "contact",
] as const;

/** Mirrors lib/hero-style.ts — the HeroStyleKey union at :16-24, the HERO_STYLES
 *  table at :26-35, and HERO_STYLE_KEYS derived from it at :37. EIGHT entries,
 *  not 3; the dossier's "3 hero styles" was wrong and was re-checked here. Plus
 *  lib/site-layout.ts (5 presets). Both are closed registries and both columns
 *  already exist on `websites`. A test asserts these two arrays are set-equal
 *  to the source registries, so a new hero can never be silently unreachable. */
export const HERO_STYLES = [
  "orbit", "spotlight", "vanguard", "aurora", "horizon", "nova", "soda", "denim",
] as const;
/** NAME COLLISION, deliberate: lib/site-layout.ts already exports
 *  `LAYOUT_KEYS: SiteLayoutKey[]`. It cannot be reused directly — `z.enum`
 *  needs a readonly tuple and that one is a mutable `string[]` — so this is a
 *  local re-declaration, and the set-equality test below is what keeps the two
 *  from drifting. Import it as `AI_LAYOUT_KEYS` anywhere both are in scope. */
export const LAYOUT_KEYS = ["flow", "showcase", "story", "compact", "express"] as const;

const hex = z.string().describe("קוד HEX בפורמט #rrggbb בלבד, לדוגמה #101014");

export const designSystemSchema = z.object({
  name: z.string().describe("שם קצר בעברית לסגנון, עד 3 מילים. לדוגמה: 'מינימלי חם'"),
  rationale: z.string().describe("משפט אחד בעברית שמסביר למה הסגנון מתאים דווקא לעסק הזה"),

  palette: z.object({
    surfaceBase: hex.describe("רקע העמוד הראשי"),
    surfaceRaised: hex.describe("רקע רצועה מודגשת — קרוב מאוד ל-surfaceBase"),
    surfaceCard: hex.describe("רקע כרטיס מוצר/תוכן"),
    surfacePanel: hex.describe("רקע פאנל פנימי בתוך מקטע"),
    inkStrong: hex.describe("צבע כותרות — חייב ניגודיות 4.5 לפחות מול surfaceBase"),
    inkBody: hex.describe("צבע טקסט רגיל — חייב ניגודיות 4.5 לפחות מול surfaceBase"),
    inkMuted: hex.describe("צבע טקסט משני — חייב ניגודיות 4.5 לפחות מול surfaceBase"),
    accent: hex.describe("צבע הדגשה למחירים, מסגרות והילות. ניגודיות 3 לפחות מול surfaceBase"),
  }),

  shape: z.object({
    radiusCard: z.number().describe("פינות כרטיס בפיקסלים, 0 עד 28"),
    radiusButton: z.number().describe("פינות כפתור בפיקסלים, 0 עד 50"),
    borderWidth: z.number().describe("עובי מסגרת בפיקסלים, 0 עד 3"),
    hairlineStrength: z.number().describe("עוצמת קווי הפרדה באחוזים, 0 עד 40"),
    shadowDepth: z.enum(["none", "soft", "deep"]),
  }),

  typography: z.object({
    headingFont: z.enum(HEBREW_FONTS),
    bodyFont: z.enum(HEBREW_FONTS),
    headingWeight: z.enum(["200", "300", "400", "600", "800"]),
    headingSize: z.enum(["sm", "md", "lg"]),
    headingTracking: z.enum(["tight", "normal", "wide"]),
    titleGap: z.number().describe("רווח מתחת לכותרת ב-rem, 0.5 עד 4"),
  }),

  rhythm: z.object({
    sectionRhythm: z.enum(["compact", "normal", "airy"]),
    contentWidth: z.number().describe("רוחב תוכן מרבי ב-rem, 40 עד 80"),
    gridColumns: z.enum(["2", "3", "4"]).describe("עמודות בגריד המוצרים במסך רחב"),
  }),

  motion: z.object({
    motionSpeed: z.enum(["still", "calm", "normal", "lively"]),
    revealDistance: z.number().describe("מרחק אנימציית הכניסה בפיקסלים, 0 עד 48"),
  }),

  buttons: z.object({
    buttonStyle: z.enum(["gradient", "solid", "outline"]),
    buttonPaddingX: z.number().describe("ריפוד אופקי ב-rem, 0.75 עד 3"),
    buttonPaddingY: z.number().describe("ריפוד אנכי ב-rem, 0.4 עד 1.4"),
    buttonWeight: z.enum(["500", "600", "700", "800"]),
  }),

  chrome: z.object({
    headerOpacity: z.number().describe("אטימות הסרגל העליון באחוזים, 40 עד 100"),
    headerBlur: z.number().describe("טשטוש הסרגל העליון בפיקסלים, 0 עד 24"),
    ctaBandStrength: z.number().describe("עוצמת רצועת הסיום באחוזים, 0 עד 40"),
  }),

  hero: z.object({
    heroFill: z.enum(["gradient", "flat"]),
    heroOverlay: z.number().describe("כהות שכבת הרקע של ה-Hero באחוזים, 0 עד 70"),
  }),

  // The two highest-leverage visual choices in the product, and both columns
  // already exist. Revision 1 left them out, which is why the AI's reach was
  // thin: it could not touch the single most dominant element on the page.
  // These are NOT written to websites.hero_style / layout_style by the route —
  // they are stored under design_draft.chrome and applied by
  // publishDesignAction only (§F.5), so the draft/publish story holds. The
  // preview sees them through getDraftSiteByBusinessId's overlay (§E.3).
  heroStyle: z.enum(HERO_STYLES).describe("סגנון ה-Hero. בחר לפי אופי העסק"),
  layoutStyle: z.enum(LAYOUT_KEYS).describe("פריסת האתר מתוך חמש הפריסות"),

  sectionOrder: z
    .array(z.enum(SECTION_KEYS))
    .describe("סדר המקטעים בעמוד, מהעליון לתחתון. יש לכלול את כל 12 המפתחות בדיוק פעם אחת"),
  sectionsHidden: z
    .array(z.enum(SECTION_KEYS))
    .describe("מקטעים שכדאי להסתיר עבור העסק הזה. אפשר מערך ריק, ולרוב זה הנכון"),
});

export type DesignSystemData = z.infer<typeof designSystemSchema>;
```

```ts
// lib/ai/schemas/store-categories.ts
export const storeCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().describe("שם הקטגוריה בעברית, עד 24 תווים"),
        children: z
          .array(z.string().describe("שם תת-קטגוריה בעברית, עד 24 תווים"))
          .describe("עד 6 תתי-קטגוריות. מערך ריק אם אין צורך"),
      }),
    )
    .describe("עד 8 קטגוריות ראשיות, לפי המוצרים שקיימים בפועל"),
  assignments: z
    .array(
      z.object({
        productId: z.string().describe("מזהה המוצר בדיוק כפי שהופיע ברשימה"),
        category: z.string().describe("שם הקטגוריה — חייב להיות אחד מהשמות שהצעת"),
      }),
    )
    .describe("שיוך של כל מוצר לקטגוריה אחת"),
});
```

### H.3 Prompt strategy

`lib/ai/agents/design-system.ts`, in the canonical shape: `SYSTEM_PROMPT` const → `buildPrompt(business, ctx)` → one `runStructured` call. It also copies **`logo-design.ts`'s defensive degradation** (`lib/ai/agents/logo-design.ts:72-113`), which is the right template for a taste agent: the whole call in `try/catch` that degrades to `null`, then **every field re-validated and clamped in TypeScript regardless of what Zod passed** — hex regex, enum membership re-check, finite-number check then `Math.min/max`. A model can satisfy `z.number()` with `radiusCard: 4000`.

**`clampDesignSystem(raw, ctx)` takes a business context and enforces five rules the prompt can only ask for.** Every one of these exists because a required-by-schema field means the model emits it on *every* generation — there is no "the AI just won't set it" path.

| rule | why |
|---|---|
| `heroFill = "gradient"` whenever `ctx.heroStyle !== "orbit"` | the `[data-hero-fill="flat"]` rule is **(0,4,1)** with `!important` and **beats** the heroes' own **(0,3,1)** blocks (§C.2). A greyed-out control does not constrain the model. |
| `heroOverlay = 0` whenever `!ctx.hasHeroImage` | up to 70% black over a hero with no background image to darken |
| `store` removed from `sectionsHidden` when `ctx.siteMode === "store"` | the reason the business exists |
| `contact` removed from `sectionsHidden` when `ctx.contactEnabled` | `page.tsx:672-717` is the business's only lead channel; the owner would be shown a preview of their own site with the lead form missing, one click from publishing it |
| `booking` removed from `sectionsHidden` when the business has booking days | same argument, for an appointments business |
| `sectionsHidden.length` capped at 4 | a model that hides half the page is malfunctioning, not opinionated |

The prompt says `אל תסתיר מקטע שהוא הסיבה שהעסק קיים`, and §H.3's own standard is that every rule be re-enforced in TypeScript regardless of what Zod passed. Revision 1 specified exactly one of these six guards.

System prompt (Hebrew, per house style, ending with `PUBLIC_COPY_CONFIDENTIALITY`):

```
אתה מעצב מוצר בכיר המתמחה באתרים לעסקים קטנים בישראל, בעברית ובכיוון RTL.
המשימה: להרכיב מערכת עיצוב מלאה (design system) לאתר של עסק אחד.

חוקים מחייבים:
- האתר מוצג על רקע כהה כברירת מחדל. אם אתה בוחר רקע בהיר — כל הצבעים
  חייבים להשתנות יחד, לא רק אחד מהם.
- ניגודיות: inkStrong/inkBody/inkMuted מול surfaceBase חייבים 4.5 לפחות.
  accent מול surfaceBase חייב 3 לפחות. חשב את זה, אל תנחש.
- surfaceRaised ו-surfacePanel חייבים להיות קרובים מאוד ל-surfaceBase
  (הפרש עדין) — הם רצועות, לא צבעים מנוגדים.
- הגופנים חייבים לתמוך בעברית. בחר רק מהרשימה הסגורה.
- סדר המקטעים חייב לכלול את כל 12 המפתחות בדיוק פעם אחת.
- אל תסתיר מקטע שהוא הסיבה שהעסק קיים (חנות לחנות, יומן לעסק תורים).
- החזר מספרים בתוך הטווחים שצוינו. אל תחרוג.
```

`buildPrompt` supplies, in Hebrew: business name / type / industry / location / target audience / description; `site_mode`; `hero_style` and its Hebrew label; the current `layout_style` and its section order; the brand palette hexes from `brand_assets.color_palette`; the count of active products and the distinct existing category strings; and which modules are enabled. For **נסו מראה אחר** it appends `` `וריאציה ${n}: הצע כיוון שונה מהותית מהקודם — לא רק גוון אחר.` `` plus the previous run's `name` so the model actively diverges.

**No end-customer PII is sent.** Business metadata, product names and category strings only. This does not worsen the free-tier Gemini privacy exposure documented at `lib/ai/providers.ts:40-55`, and the spec forbids ever feeding order history or customer records to this agent.

### H.4 Token cap, with justification

Register **both** new agents in `HEAVY_AGENTS` (`lib/ai/limits.ts:43-57`) → `HEAVY_CAP = 8000`.

| | JSON payload | Gemini thinking | total |
|---|---:|---:|---:|
| `design_system` | ~550 (32 mostly-enum/number/hex fields + 2 short Hebrew strings + a 12-item array) | 1500–3000 | **~3550 worst case** |
| `store_categories` | ~1100 (8 parents × ~5 children with Hebrew labels + one assignment row per product) | ~1000–1800 | **~2900 worst case** |

The thinking figure is the decisive input and comes from production `agent_logs`, not from the schema. Gemini reports reasoning tokens inside `usage.outputTokens`, and `maxOutputTokens` gates thinking **and** JSON together — so overflow does not truncate gracefully, it produces `"No object generated: could not parse the response"`. Evidence: `stock_keywords` returns a ~15-token payload and reports 9–21 output tokens on Anthropic but **213–396 on Gemini**; `logo_options` — a strictly *simpler* taste judgement than this one — has already hit **2485 against its 2500 cap (99.4%)**.

8000 gives 2.25× headroom on the worst case, inside the repo's own stated 1.5–2× convention (`lib/ai/limits.ts:21-22`) with margin for the fact that both figures are extrapolations.

**Do not use `XL_CAP`.** `tests/ai-limits.test.ts:69-73` asserts that `landing`'s cap is strictly greater than every heavy agent's; adding a second XL member violates that invariant's intent even if the assertion still passes.

Also add both keys to `LIGHT_AGENTS` in `lib/ai/providers.ts:74-87`? **No** — leave them out, so in paid mode they draw the reasoning tier (Sonnet). These are taste judgements, exactly like `logo_options`, which `providers.ts:91-92` deliberately keeps on Sonnet. Note the pre-existing inconsistency this exposes: `logo_options` is LIGHT in `limits.ts` but not in `providers.ts` — do not "fix" that here; it is unrelated and load-bearing (§K).

**Quota cost, stated deliberately.** `lib/ai/run.ts:73` bumps `recordAiGeneration` per successful call and `:42` charges the 20/hour/business bucket per call. A store generating both agents burns **2 units**. Mitigations built in: the category agent runs **only** for `site_mode === "store"` **and only** when `store_categories` is empty; **נסו מראה אחר** is rate-limited client-side to one call per 20 seconds and shows the remaining hourly budget after the 10th call in an hour; and the studio keeps the last 3 generated systems in `design_draft.history` so flipping back is free.

### H.5 Regenerate / "try another look" UX

- Button: **נסו מראה אחר** with a `Sparkles` icon and a Hebrew helper: *"ה-AI ירכיב סגנון שונה. השינוי לא ישפיע על האתר החי עד שתפרסמו."*
- While running: the button becomes a spinner and the preview dims to 60% with a Hebrew step ticker (*מרכיב פלטה… · בוחר גופנים… · מסדר את המקטעים…*), same cosmetic-rotation pattern as `website-watcher.tsx:10-16`.
- On success the preview cross-fades to the new design. The up-to-3 variant chips (`design_draft.history[]`, each `{ name, tokens, sections, chrome, at }`) sit **above** the button in the מראה panel, on the same row as the 6 shipped presets (§F.2) — free, client-side, no further AI calls. Revision 1 put them below and surfaced the remaining hourly budget only "after the 10th call in an hour"; a shiny AI button that dies on click 11 with *"מכסת ה-AI היומית נגמרה"* is a ruined first session, so the budget is shown **from the first click**.
- On failure: `toast.error(res.error)` with the Hebrew message from the route, and the current draft is untouched. Two failure strings the route must translate rather than leak:
  - Gemini free-tier exhaustion (`"You exceeded your current quota…"`) → **"מכסת ה-AI היומית נגמרה. נסו שוב מאוחר יותר או ערכו ידנית."**
  - `"No object generated: could not parse the response"` → **"ה-AI החזיר תשובה חלקית. נסו שוב."**
  Both are wrapped in `try/catch` in the route; raw model errors are never surfaced verbatim, unlike `lib/actions/modules.ts:53`.
- **The Anthropic fallback is dead** (`lib/ai/run.ts:98-115` — every Anthropic call since 2026-07-21 fails with `"Your credit balance is too low"`, last seen 2026-08-03). So there is effectively **no** retry beyond the SDK's 3 attempts. That is why `lib/ai/agents/design-system.ts` degrades to a **hand-written default design system** (`DEFAULT_DESIGN` = today's literals, i.e. an empty token set + the preset section order) rather than throwing. The owner always lands in a working studio.

  **Two hard requirements on the degraded path, both missing from revision 1 and both worse than the failure itself:**
  1. **`design_generated_at` is written ONLY on a genuine agent success.** §F.1 gates first-run generation on `!website.design_generated_at`. If the route wrote the timestamp unconditionally, an owner whose first open hit a Gemini quota failure would watch a 35-second progress card, land on a studio that looks exactly like their unchanged site, be told nothing — and **never get the first-run generation again**. Given §H.5's own admission that the Anthropic fallback is dead and free-tier exhaustion is live, this is not a rare path.
  2. **Say so.** Degrading renders a Hebrew card — *"לא הצלחנו להרכיב עיצוב כרגע — הנה האתר כפי שהוא. נסו שוב."* — with a retry button, instead of presenting the owner's unchanged site as the AI's work. `DEFAULT_DESIGN` is a safe landing, not a result.
- **No safety-block handling exists anywhere in the codebase** — a Gemini content-filter refusal is indistinguishable from truncation. Both land on the same Hebrew message above. Noted as a known gap (§K), not solved here.

---

## I. File-by-file work plan

**Partitioned so that no two packages write the same file.** There is no git; a conflict is unrecoverable. Every package states its backups.

### Global pre-flight (do this ONCE, before any package starts)

```
mkdir -p "<scratchpad>/design-studio-backup/before"
```
Copy verbatim into `before/`, preserving relative paths:
```
app/s/[slug]/page.tsx
app/s/[slug]/layout.tsx
components/public/tiers/tier-styles.tsx
components/public/public-store.tsx
components/business/store-manager.tsx
lib/services/website.service.ts
lib/actions/store.ts
lib/site-mode.ts
components/shared/business-nav.tsx
lib/ai/limits.ts
lib/ai/providers.ts
types/database.ts
tests/ai-limits.test.ts
tests/storefront-brand.test.ts
app/(dashboard)/businesses/[businessId]/store/page.tsx
```
Then capture the parity baseline (this is the evidence for hard requirement 1):
```
node scripts/snapshot-storefronts.mjs --out "<scratchpad>/design-studio-backup/html-before"
```
(`scripts/snapshot-storefronts.mjs` is created by **P0** below.)

**Citation hygiene — a standing rule for every package, not a suggestion.**

Every `file:line` in this spec is an **index, not an address**. Locate each edit by grepping the quoted *old text*; if the grep finds a different line number than the spec says, the grep is right. Revision 1 shipped one confirmed drift; revising it surfaced **six more** in the same document, all fixed above and all of the same shape (a citation pointing at the container instead of the element, or at a neighbouring line):

| was | is | what it points at |
|---|---|---|
| `page.tsx:420` | **`:421`** | the benefits `<CheckCircle2>` — and there is a **second** one at `:527` that must not be touched |
| `page.tsx:838` | **`:834`** | `<header data-el="chrome-header" class="sticky top-0 z-50 …">` |
| `page.tsx:487` | **`:463-464`** | the about section's non-split branch (`:487` is `const aboutSection = …`) |
| `page.tsx:499` | **`:500`** | the services `<h2 data-el="section-title">` (`:499` is its container div) |
| `page.tsx:435`/`:487` (titles) | **`:436`** / **`:465`** | the two about headings, one per variant |
| `lib/hero-style.ts:26-34` | **`:26-35`** table, **`:37`** `HERO_STYLE_KEYS` | the 8-hero registry |

A package that applies an edit by line number without confirming the text is doing the one thing this spec cannot protect against.

---

### P0 — Parity baseline harness + lint gate
**Depends on:** nothing.
**Creates:** `scripts/snapshot-storefronts.mjs`, `scripts/compare-storefronts.mjs`, `scripts/qa-gate.mjs`
**Modifies:** nothing.
`snapshot` fetches every published slug from production (or a local `npm run build && npm start`), writes normalised HTML per slug (strip `nonce=`, `data-reactroot`, any timestamp, and collapse whitespace); `compare` diffs two directories and exits non-zero on any diff.

`qa-gate.mjs` runs, in order and failing on the first non-zero exit: **`npx eslint .`**, `npx tsc --noEmit`, `npx vitest run`. **Every package must pass `qa-gate` before handing off.** The eslint step is not optional politeness: revision 1 of this spec contained a `Date.now()` call inside two async server component bodies (§E.3), which is a hard `react-hooks/purity` error in this repo, and it would have reached two separate packages before anyone noticed. The gate is what makes that class of finding impossible to land.

This is the only package that must land before every other one.

---

### P1 — Migration + types + data services
**Depends on:** nothing.
**Creates:**
- `supabase/migrations/0086_design_studio.sql` (§B.1, applied via Supabase MCP `apply_migration`)
- `lib/services/site-design.service.ts` — `getDesign(businessId)`, `saveDraft(businessId, design)`, `publishDesign(businessId, design)`, `setDesignGeneratedAt(businessId, iso)`. Owner reads/writes on `createClient()` (RLS); no service-role path.
- `lib/services/store-categories.service.ts` — owner: `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategories(businessId, snapshot)`, `assignProducts(businessId, productIds, categoryId)` (**with the `business_id` predicate**); public: `getPublicCategoryTree(businessId)` on `createServiceRoleClient()`.
- `docs/design-studio/README.md` (house format: date blockquote + "אל תתכננו מחדש", file table, status table with the resume pointer)
**Modifies:** `types/database.ts` (§B.2 — the six hand-edits; **never regenerate**).
**Backups:** `types/database.ts`.
**Note:** `design_live` is written by `publishDesign` only. RLS + table grants mean a determined owner *could* PATCH `design_live` directly via PostgREST and skip the contrast auto-correct. That is accepted: the blast radius is their own site, and the fix (a `BEFORE` trigger validating the JSON) is disproportionate. Documented in the migration header.

---

### P2 — Pure resolver modules + their tests
**Depends on:** nothing (takes `unknown`, imports no DB types).
**Creates:**
- `lib/site-design.ts` — `DesignConfig`, `ResolvedTokens`, `TOKENS` registry (32 entries: `{ key, label, group, type, min?, max?, values?, unit?, cssVar, emit }` where `emit` returns a **var-name → serialised-value map**, §C.1c), `safeDesignHex`, `resolveDesignConfig(raw): DesignConfig | null`, `designToCss(design, plan, ctx): string`, `auditContrast`, `autoCorrectContrast`, `DEFAULT_DESIGN`, `PRESETS` (the 6 shipped looks, §F.2).
- `lib/site-sections.ts` — `SECTION_SLOTS`, `sectionSlotsFor`, `TITLE_EDITABLE`, `ALIGN_CAPABLE`, `SECTION_LABELS`, `BENEFIT_ICONS`, `SectionOverrides`, `resolveSectionPlan` (§D.2, §D.3).
- `lib/site-categories.ts` — `CategoryNode`, `buildCategoryTree(rows): CategoryNode[]` (2-level cap, orphan re-rooting, stable sort by `sort` then `created_at`), `normalizeCategoryOrder(snapshot)` → contiguous sorts.
- `lib/studio-messages.ts` — the postMessage types + two type-guard functions.
- `tests/site-design.test.ts`, `tests/site-sections.test.ts`, `tests/site-categories.test.ts` (§J).
**Modifies:** nothing.

---

### P3 — Token engine in the tier stylesheet
**Depends on:** P2 (`designToCss` lives there; this package only consumes the var names).
**Creates:** `components/public/theme-style.tsx` — a server component: `({ design, plan, ctx }) => design ? <style>{designToCss(design, plan, ctx)}</style> : null`. The CSS is a **React text child**, never `dangerouslySetInnerHTML` (§E.5).
**Modifies:**
- `components/public/tiers/tier-styles.tsx` — the ~60 literal→`var()` wraps in §C.3 and the one in `sharedCss`.
- `tests/storefront-brand.test.ts` — **a comment only**, at the surface-hex list (`:107`), recording that those remain the *unthemed* surfaces and that themed surfaces are covered by `auditContrast` (§J). **No assertion changes**; the CTA-ink pin at `:118-124` must keep passing, which is exactly why `tier-styles.tsx:465` is on the do-not-tokenise list. This file is listed here so it has a sole writer — it is the only file in §J that is not otherwise owned by a package.

**Backups:** `components/public/tiers/tier-styles.tsx`, `tests/storefront-brand.test.ts`.
**Before starting:** re-derive every line number in §C.3 against the live file. Match on the **old text**, never on the number.
**Verification before handing off:** `qa-gate` clean, then `node scripts/compare-storefronts.mjs html-before html-after` clean. Every edit in this package is a computed-value no-op; a single diff means one of them is wrong.

---

### P4 — Storefront category rail
**Depends on:** P1 (`getPublicCategoryTree`), P2 (`buildCategoryTree`).
**Creates:** `components/public/category-rail.tsx`.
**Creates:** `components/public/category-sheet.tsx` — the mobile bottom sheet (§G.3).
**Modifies:** `components/public/public-store.tsx` — accept `categories?: CategoryNode[]` and `title?: string` (default `"החנות שלנו"`, §D.4), render the `lg` grid + rail, keep the existing chip row **verbatim** below `lg` when the tree is one level deep and switch to the sheet trigger when any root has children, stamp `data-slot="title|categories|filters|grid"` on the four direct children of the section, and keep `id="store"` / `data-el="module-section"` / `data-el="section-title"` / `data-el="product-grid"` exactly where they are.
**Backups:** `components/public/public-store.tsx`.
**Hard constraints:**
- `categories === undefined || categories.length === 0` must produce **byte-identical** output to today, including the single-column layout (no grid wrapper emitted at all).
- A one-level tree must render the chip row byte-identically to today at `<lg` — this is what covers every store that exists, since §B.1's backfill creates roots only.
- The `<h2 data-el="section-title">` keeps its `<ShoppingBag>` child; the title is a **sibling text node**, so the preview bridge can mutate it without deleting the icon (§D.4).

---

### P5 — Draft preview transport
**Depends on:** P2 (`lib/studio-messages.ts`).
**Creates:**
- `lib/studio-preview.ts` — `mintPreviewToken(businessId, userId, nowMs)`, `verifyPreviewToken` (total, try/catch, length-checked), `readStudioSession` (the **only** place `Date.now()` is called; see §E.3 — never inline it in a component body), and the module-scope `SECRET` hard-fail (§E.2).
- `app/api/studio/preview-session/route.ts` — `POST` (mint + set cookie) / `DELETE` (clear). **`getUser()` + explicit 401**, not `requireUser()` — `lib/auth/user.ts:22-30` calls `redirect("/login")`, which in a route handler is a 307 the studio's `fetch` follows and then fails to parse; the repo's route convention is `design/generate/route.ts:13-14`. Then `getBusiness(businessId)` on the RLS client for ownership, and an explicit **`Origin` check against `process.env.NEXT_PUBLIC_APP_URL`** before minting — route handlers get none of the origin validation Server Actions get, and this one mints a credential. (Cross-site POSTs do arrive unauthenticated because Supabase's auth cookie is `SameSite=Lax`, but that is a dependency's configuration, not something this codebase asserts.)
- `components/public/studio-bridge.tsx` — the in-iframe client bridge (§E.4, §E.5), including `resolveDesignConfig` on every inbound design and `styleEl.textContent` (**never** `innerHTML`).
- `tests/studio-preview.test.ts` — round-trip, expiry, tamper, wrong-business, **wrong-length signature**, **module throws with the env unset**, wrong-user.
**Modifies:**
- `lib/services/website.service.ts` — add `getDraftSiteByBusinessId` (`.limit(200)`, draft→live overlay, `chrome.heroStyle`/`layoutStyle` overlay); extend `getPublicSiteBasicsBySlug` to return `{ mode, businessId }`; replace `getPublicSiteBySlug`'s `websites` `.select("*")` with the explicit 21-column list + `design_live` (§E.3). **`getPublicSiteBySlug`'s product `.limit(24)` and its `.order("sort_order")` are NOT changed** — see §G.3.
- `app/s/[slug]/layout.tsx` — the **match-gated** cookie bypass (§E.3), which keeps the basics lookup unconditional.
**Backups:** `lib/services/website.service.ts`, `app/s/[slug]/layout.tsx`.

---

### P6 — Storefront integration (the single integration point)
**Depends on:** P2, P3, P4, P5.
**Modifies:** `app/s/[slug]/page.tsx` **only**. This package exists so that exactly one agent ever writes this 1025-line file.
Changes, all additive:
1. imports for `resolveDesignConfig`, `resolveSectionPlan`, `sectionSlotsFor`, `readStudioSession`, `getDraftSiteByBusinessId`, `ThemeStyle`, `StudioBridge`, `getPublicCategoryTree`, the `BENEFIT_ICONS` component map
2. studio-session branch at `:180` (§E.3) — via `readStudioSession`, **never an inline `Date.now()`**; matched against the `customerUser` the existing `Promise.all` already resolves
3. `design` + `plan` + `slotCtx` derivation after `:373`, and `effectiveBodyFont` / `effectiveHeadingFont` (§C.2)
4. `orderedSections` rewrite at `:739-753` (§D.4) — **`className="contents"` preserved in every branch; `data-sec` unconditional under `wrapAll`**
5. `data-no-rhythm` on the reviews wrapper at `:660` (§C.2)
6. root-div attributes at `:782-786` (§D.4) — including the `hero_style === "orbit"` gate on `data-hero-fill`
7. `<ThemeStyle>` after the inline `<style>` at `:830`; `<StudioBridge>` + the `noindex` meta only in studio mode; and the studio-mode suppression of `SiteVisitTracker`, `StoreChatWidget`, `SitePopup`, `WhatsAppFloat`, the `.float-btn` fallback and `AnnouncementBar` (§E.3)
8. `effectiveHeadingFont` into the inline `<style>` at `:829`, and the two token families into `fontsHref` behind `HEBREW_FONTS.includes` (§C.2)
9. `data-slot="…"` on the direct children of `about`, `services`, `booking`, `faq`, `contact`
10. **title overrides rendered as React text children** on the `about` / `services` / `booking` / `faq` / `contact` `<h2>`s, and `title` threaded into `<PublicStore>` (§D.4)
11. per-card benefit icon lookup at `:420`, defaulting to `CheckCircle2` (§D.4)
12. `categories` + `title` props threaded into `<PublicStore>` at `:540-549`
13. `translateY(26px)` in the inline `[data-reveal]` block at `:821` → `translateY(var(--t-rise-page, 26px))`. **Tokenise it; do NOT unify it.** Revision 1 described this as "unifying it with `tier-styles.tsx:509`" — the two fallbacks are deliberately different (26px here, 32px at `tier-styles.tsx:508`, 24px at `:380`) and **must stay different**, or the empty-config guarantee breaks. All three are driven by `revealDistance`'s derived ramp (§C.2).
**Backups:** `app/s/[slug]/page.tsx`.
**Verification:** `qa-gate` clean; parity run clean for all 9 published sites; then a manual check that all three `[data-reveal]` sources still compute to 26 / 32 / 24 px with no design.

---

### P11 — Sub-route theme parity
**Depends on:** P2, P3.
**Modifies:** `app/s/[slug]/product/[productId]/page.tsx`, `app/s/[slug]/blog/page.tsx`, `app/s/[slug]/blog/[postId]/page.tsx` — three files no other package touches.
**Backups:** all three.

Four routes render `data-tier` + `<TierStyles>`, not one:

| file | root | TierStyles |
|---|---|---|
| `app/s/[slug]/page.tsx` | `:783` | `:787` |
| `app/s/[slug]/product/[productId]/page.tsx` | `:167` | `:168` |
| `app/s/[slug]/blog/page.tsx` | `:62` | `:63` |
| `app/s/[slug]/blog/[postId]/page.tsx` | `:117` | `:118` |

Revision 1 confined the theme to `page.tsx` and never mentioned the other three in its 24 risks. An owner who themed their store to a light ground would have got a light homepage and a **hard-black product page, blog list and blog post**, with cart/wishlist/product links moving the visitor between the two on every click. Not a regression against today, but a shipped inconsistency presented as an oversight rather than a choice.

Each of the three gains: `resolveDesignConfig(website.design_live)`, the `data-design` / `data-btn` root attributes, `<ThemeStyle design={design} plan={null} />` after its `<TierStyles>`, and **`data-no-rhythm` on its `<main data-el="module-section">`** (`product:211` `py-8`, `blog:90` `py-10`, `blog/[postId]:149` `py-10` — page shells, not page sections; §C.2). They pass `plan={null}` because they have no ordered sections. `blog/page.tsx:110` carries `data-el="product-grid"` and will therefore honour `gridColumns`, which is correct and intended.

`data-hero-fill` is **not** stamped on any of the three — none renders a hero.

*(Rejected: extracting a shared `<SiteThemeRoot>` server component. It would put four files into one package's blast radius for the sake of ~8 duplicated lines, and `page.tsx`'s root additionally carries the `effectiveBodyFont` inline style and the hero gate. The duplication is accepted and documented here so it reads as a decision.)*

---

### P7 — Studio UI
**Depends on:** P1, P2, P5.
**Creates:**
- `app/(dashboard)/businesses/[businessId]/studio/page.tsx`
- `components/business/studio/design-studio-root.tsx` (client root; holds state, undo stack, debounce, `DirectionProvider`)
- `components/business/studio/preview-frame.tsx`
- `components/business/studio/overlay-layer.tsx`
- `components/business/studio/section-list.tsx` + `section-row.tsx` (module-level!)
- `components/business/studio/look-panel.tsx` — the default **מראה** tab: preset row, AI variant chips, name + rationale, the 4 primary tokens, נסו מראה אחר, החליפו תמונת Hero (§F.2)
- `components/business/studio/token-panel.tsx`, `color-field.tsx`, `slider-field.tsx`, `enum-field.tsx`, `font-field.tsx`
- `components/business/studio/contrast-notice.tsx`
- `components/business/studio/publish-bar.tsx` — including the **text change-list** confirm dialog (§F.5)
- `components/business/studio/design-watcher.tsx`
- `components/ui/slider.tsx`, `components/ui/popover.tsx`, `components/ui/accordion.tsx` (Base UI wrappers, `components/ui/switch.tsx` style)
- `lib/actions/site-design.ts` — `saveDesignDraftAction`, `publishDesignAction` (owner/admin-gated, §F.5), `resetDesignAction`
**Modifies:** nothing existing.
**No longer depends on P10** — the category manager is not mounted in the studio (§F.2). The studio only links to `/businesses/{id}/store`.

---

### P8 — Nav wiring
**Depends on:** nothing (the route can 404 until P7 lands).
**Modifies:** `lib/site-mode.ts` (add `"studio"` to `BusinessNavKey`), `components/shared/business-nav.tsx` (add the `ITEMS` entry after `website`).
**Backups:** both files.

---

### P9 — AI agents
**Depends on:** P1 (services), P2 (`TOKENS` for clamping).
**Creates:**
- `lib/ai/schemas/design-system.ts`, `lib/ai/schemas/store-categories.ts`
- `lib/ai/agents/design-system.ts`, `lib/ai/agents/store-categories.ts`
- `app/api/businesses/[businessId]/design-system/generate/route.ts`
- `app/api/businesses/[businessId]/store-categories/suggest/route.ts`
- `tests/design-system-agent.test.ts` (the pure clamp/validate function only)
**Modifies:** `lib/ai/limits.ts` (both keys → `HEAVY_AGENTS`), `lib/ai/providers.ts` (a comment only — deliberately **not** added to `LIGHT_AGENTS`), `tests/ai-limits.test.ts` (add both keys to the real-output-size map).
**Backups:** all three modified files.

---

### P10 — Category manager + product assignment
**Depends on:** P1, P2.
**Creates:**
- `components/business/category-manager.tsx`
- `components/business/category-assign-panel.tsx`
- `lib/actions/store-categories.ts` — `createCategoryAction`, `renameCategoryAction`, `moveCategoryAction`, `deleteCategoryAction`, `reorderCategoriesAction`, `assignProductsToCategoryAction`. **All six** carry the four-step guard chain in §G.2 (`requireUser` → `getBusiness` → RLS client → both `business_id` and `id` predicates); `moveCategoryAction` additionally loads and null-checks the target parent.
**Modifies:**
- `components/business/store-manager.tsx` — replace the two free-text category inputs with the tree `<Select>`
- `lib/actions/store.ts` — read `category_id` in `saveProductAction`; route the CSV path through `resolveOrCreateCategory`
- `app/(dashboard)/businesses/[businessId]/store/page.tsx` — mount the manager card
**Backups:** all three modified files.

---

### Dependency graph

```
P0 ──(gate for everything: parity baseline + qa-gate)
P1 ─┬───────────────────► P7
P2 ─┼─► P3 ─┬─► P6
    ├─► P4 ─┤
    └─► P5 ─┘
    └─► P3 ─► P11
P1 ─────► P10
P1,P2 ──► P9
P8 (independent)
```

Parallelisable in 4 waves: **{P0}** → **{P1, P2, P8}** → **{P3, P4, P5, P9, P10}** → **{P6, P7, P11}**.

**File-partition audit — no two packages write the same file.** Verified against the lists above:

| file | sole writer |
|---|---|
| `types/database.ts` | P1 |
| `components/public/tiers/tier-styles.tsx`, `tests/storefront-brand.test.ts` | P3 |
| `components/public/public-store.tsx` | P4 |
| `lib/services/website.service.ts` | P5 |
| `app/s/[slug]/layout.tsx` | P5 |
| `app/s/[slug]/page.tsx` | P6 |
| `lib/site-mode.ts`, `components/shared/business-nav.tsx` | P8 |
| `lib/ai/limits.ts`, `lib/ai/providers.ts`, `tests/ai-limits.test.ts` | P9 |
| `components/business/store-manager.tsx`, `lib/actions/store.ts`, `app/(dashboard)/businesses/[businessId]/store/page.tsx` | P10 |
| `app/s/[slug]/product/[productId]/page.tsx`, `app/s/[slug]/blog/page.tsx`, `app/s/[slug]/blog/[postId]/page.tsx` | P11 |

Everything else in every package is a **new** file. P7 creates only new files.

Effort estimate: ~5 focused days, ~46 files (35 new / 14 modified), 1 migration, 2 new AI agents, **no new npm dependency** (`@dnd-kit/*`, `@base-ui/react`, `zod`, `sonner` are all already installed).

---

## J. Test plan

Constraint: `vitest.config.ts:12` collects **only** `tests/**/*.test.ts`, `environment: "node"`, no jsdom, no `setupFiles`, no `globals`. There is no `@testing-library`, and `vi.mock`/`vi.fn` appear **zero** times in the existing 27 files. **Do not add component tests and do not change vitest.config.ts.** Everything testable is extracted into a pure `lib/` module first — which is why §I puts all resolvers in P2.

### `tests/site-design.test.ts`

**`TOKENS` registry** (the `tests/modules.test.ts` invariant shape)
- exactly 32 entries; `new Set(keys).size === 32`
- `TOKENS[def.key] === def` for every def
- every def has a non-empty Hebrew `label`, a `group`, a `cssVar` starting `--t-`, and either `values` (enum) or both `min`/`max` (number) or `type === "color"`
- every `cssVar` is unique, **including derived vars** across all `emit` outputs
- every `cssVar` named in the table appears in the string returned by `designToCss` for a fully-populated design
- **the no-false-defaults invariant** — for every def, evaluating `emit(default)` reproduces **every literal it replaces** in `tier-styles.tsx` / `page.tsx`, **or** the def appears in an explicit `UNIFIES` allowlist naming those literals. Assert `UNIFIES` contains exactly `inkStrong` and `inkMuted` (§C.2). This is the assertion that would have caught revision 1's four false "default = today's literal" claims, and it fails loudly if anyone adds a fifth.
- **unit serialisation** — for a fully-populated design, every emitted custom property whose def declares a `unit` ends with that unit. Negative cases: `designToCss` never emits a bare number for `--t-border-w`, `--t-btn-px`, `--t-btn-py`, `--t-radius-card`, `--t-radius-btn`, `--t-header-blur`, `--t-title-gap`, `--t-measure`, `--t-rise`/`--t-rise-page`/`--t-rise-hero`, `--t-cta-mix`, `--t-hair*`; while `--t-grid-cols` and `--t-hero-overlay` **are** unitless.
- **specificity ledger** — a table of every selector `designToCss` can emit and its computed `(a,b,c)`. Assert every selector that must beat a hero's own `[data-tier="professional"] [data-el="hero"] h1.xx-h1` block is **strictly greater than (0,3,1)**. `ThemeStyle` is not the last stylesheet on the page (§C.1), so nothing may rely on document order.

**`resolveDesignConfig`**
- `{}` → `null` ← **the zero-change guarantee, asserted directly**
- `null`, `undefined`, `[]`, `[1,2]`, `"x"`, `42`, `{ tokens: null }`, `{ tokens: {} }` → all `null`
- `{ tokens: { radiusCard: 12 } }` → non-null, and every *other* token absent from the result
- unknown token keys dropped
- `radiusCard: 4000` → clamped to 28; `-5` → 0
- **`radiusCard` given `"12"` (string), `NaN`, `Infinity`, `-Infinity`, `{}`, `[]`, `null`, `true` → the token is DROPPED, never coerced.** One case per number-token unit kind (px / rem / %). `Math.min(max, Math.max(min, Number(v)))` returns `NaN` for three of these and `NaN<unit>` is a live IACVT that squares every product card or collapses every section's padding (§C.1b).
- `surfaceBase: "red"` / `"#ggg"` / `"#12345"` / `null` / `42` → dropped, and the emitted CSS contains **no `--t-surface-0` declaration at all** (asserted on the string, so a `#2563eb` substitution fails the test)
- `surfaceBase: "#abc"` → accepted **and normalised to `#aabbcc`**, so every downstream consumer sees 6 digits
- `surfaceBase: "#aabbccdd"` → **dropped.** `safeHexColor` would accept it, `hexToRgb` discards the alpha, and `contrastRatio` would then measure the opaque colour — which is how `inkBody: "#c9c9c900"` would pass the AA audit and render invisible text (§C.1a). Assert `safeDesignHex("#aabbccdd") === null`.
- `headingFont: "Comic Sans MS"` → dropped (not in `HEBREW_FONTS`); `"Rubik"` → kept
- `{ tokens: {...}, history: [...], undo: [...] }` → `history` and `undo` are absent from the resolved config and appear nowhere in `designToCss` output (§F.4)

**`designToCss`**
- `designToCss(null, plan)` → `""`
- a design with only `radiusCard` emits exactly one custom property and no rule blocks
- output never contains `@layer`
- output never contains a `;` or `}` injected from a token value (feed `surfaceBase: "#fff; } body{display:none"` → dropped by `safeDesignHex`, asserted)
- output never contains the substring `content:` — the title override is a server-rendered React text child and **must never** be implemented through a CSS pseudo-element (§D.4)
- **`sectionRhythm: "normal"` emits NO padding rule.** *(This replaces revision 1's assertion, which demanded the opposite.)* `4rem` is not today's value for `page.tsx:660`'s reviews wrapper (no padding class; its child `site-reviews.tsx:44` is `py-16`, so the rule double-pads by 8rem), nor for `certifications-section.tsx:26` / `partners-section.tsx:25` (`py-14`). `compact` and `airy` **do** emit it.
- the emitted padding selector is `[data-el="module-section"]:not([data-no-rhythm])`
- **no `display:flex` rule is emitted for `about` when `ctx.aboutVariant === "split" && ctx.hasHeroImage`** — `page.tsx:434`'s sole child is `.grid.md:grid-cols-2`, and forcing `flex-direction: column` on it collapses the `story` layout's two-column split, which is that layout's entire reason to exist
- no slot rule at all is emitted when `props[k].slots` is an identity order and `slotsHidden` is empty
- an `align` for a key outside `ALIGN_CAPABLE` emits nothing
- `gridColumns` rule is inside `@media (min-width: 1024px)`

**`auditContrast` / `autoCorrectContrast`**
- today's literals (`#000000` ground, `#f4f4f4` / `#c9c9c9` / `#b0b0b0` inks) → **zero** issues
- `surfaceBase: "#ffffff"` with the default inks → issues for all three inks, each with `ratio < 4.5`
- `autoCorrectContrast` output re-audits to **zero** issues, for 200 pseudo-random ground/ink pairs (seeded LCG, no `Math.random`)
- `autoCorrectContrast` is idempotent: `f(f(x)) === f(x)`
- derived `--t-btn-ink` always clears 4.5 against the resolved accent
- never throws on junk hexes

### `tests/site-sections.test.ts`

- `resolveSectionPlan(undefined, FLOW)` → order **exactly equals** `SITE_LAYOUTS.flow.sections`, `hidden` empty, `props` `{}`
- same for `null`, `"x"`, `[1,2]`, `42`, `{ order: "nope" }`
- `{ order: ["contact"] }` → `contact` first, then the other **11** preset keys in preset order; length is 12
- `{ order: ["contact","contact","about"] }` → dedupe, length 12
- `{ order: ["portal","shop"] }` → both dropped, result equals the preset
- **new-key invariant:** for each of the 5 presets, `resolveSectionPlan({ order: preset.slice(0, 3) }, preset)` returns all 12 keys — i.e. a section added to the registry later can never disappear
- `hidden: ["store","bogus"]` → `hidden` is `Set{"store"}`
- `props: { about: { align: "middle" } }` → `align` dropped; `{ align: "end" }` → kept
- `props: { about: { slots: ["media","nope","title"] } }` → `["media","title","body","values"]` (unknown dropped, missing appended in registry order)
- `props: { reviews: { title: "x" } }` → dropped (`reviews` ∉ `TITLE_EDITABLE`)
- `props: { about: { title: "א".repeat(200) } }` → length 80
- `props: { store: { align: "end" } }` → dropped (`store` ∉ `ALIGN_CAPABLE`); `{ about: { align: "end" } }` → kept
- `props: { benefits: { icons: ["Star", "NotAnIcon"] } }` → `["Star", "CheckCircle2"]`
- **`data-sec` invariant:** the section-wrapper predicate returns `true` for **all 12 keys** whenever a design exists or studio mode is on, **regardless of `props`** — this is what makes preview reordering possible at all (§E.5). And it returns `false` for a non-condensed layout with no design and no studio session, which is the zero-change guarantee.
- **cross-registry integrity:** every key in `SECTION_SLOTS`, `TITLE_EDITABLE`, `ALIGN_CAPABLE` and `SECTION_LABELS` is a member of `SiteSectionKey`, and `SECTION_LABELS` is **exhaustive** over `SiteSectionKey` (the `tests/site-mode.test.ts:36-40` pattern). Every label and hint is a non-empty string.
- every `SECTION_SLOTS` value has unique entries and length ≥ 1
- `sectionSlotsFor("about", { aboutVariant: "split", hasHeroImage: true })` → `[]`; `{ aboutVariant: "default" }` → `["title","body","values"]` with **no `"media"`**, because the non-split branch (`page.tsx:463-464`) has no media child and a toggle for it would visibly do nothing

### `tests/site-categories.test.ts`

- `buildCategoryTree([])` → `[]`
- junk input (`null`, `"x"`, `[{}]`, rows missing `id`) → `[]`, never throws
- 3 roots + 2 children → correct nesting, roots sorted by `sort` then `created_at`, children likewise
- a **grandchild** (parent whose parent has a parent) is re-rooted, not dropped, and not infinitely nested
- a **cycle** (`a.parent = b`, `b.parent = a`) terminates and produces 2 roots — assert with a 50 ms timeout so a regression to an infinite loop fails loudly
- `parent_id` pointing at a nonexistent id → the node is re-rooted
- `visible: false` nodes are present in the tree but flagged; the public filter drops them **and** their children
- `normalizeCategoryOrder` produces contiguous `0..n-1` sorts per parent, preserving the given order
- **near-duplicate reality check:** `["חולצות", "חולצות וטופים"]` produce **two distinct roots** — asserted, because production already contains exactly this pair on business `d6d97eb4` and a future "dedupe" refactor must break this test loudly rather than silently merging a live store's categories

### `tests/studio-preview.test.ts`

- `verifyPreviewToken(mintPreviewToken(B, U, t), t)` → `{ businessId: B, userId: U }`
- `verifyPreviewToken(mint(B, U, t), t + 900_001)` → `null` (expired)
- flipping any single character of the signature → `null`
- swapping the businessId segment while keeping the signature → `null`
- swapping the **userId** segment while keeping the signature → `null`
- `undefined`, `""`, `"v1"`, `"v2.B.U.0.sig"`, `"v1.B.U.notanumber.sig"`, a non-uuid businessId → `null`
- a token minted with a different secret → `null`
- **a signature of the WRONG BYTE LENGTH → `null`, not a throw.** `crypto.timingSafeEqual` raises `RangeError` on a length mismatch, and this function now runs on every anonymous request to every live storefront under `/s` — an uncaught throw there is a customer's shop returning 500, stickily, until they clear a cookie. The "tamper" case above uses a same-length mutation and misses this entirely (§E.2).
- **the module throws at import time when `STUDIO_PREVIEW_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are both unset or empty.** Every other case in this list passes with an empty HMAC key, which is exactly the state in which anyone can mint a token for any business.

### `tests/ai-limits.test.ts` (modified, P9)

Add `design_system: 3550` and `store_categories: 2900` to the real-output-size map, so the existing invariants (`cap ≥ 1.5× real`, `min(HEAVY) > max(LIGHT)`, `landing` strictly largest) are enforced for the new agents too. **Do not** touch `tests/model-tiering.test.ts` — it only passes when `GEMINI_API_KEY` is absent from the environment, and adding entries there would inherit that fragility.

### `tests/design-system-agent.test.ts` (P9)

Tests only the pure post-Zod clamp function `clampDesignSystem(raw: unknown): DesignSystemData`:
- a model returning `radiusCard: 4000` → 28; `-9` → 0; `NaN` → the default
- `headingWeight: "150"` → `"200"`
- `sectionOrder` missing 4 keys → all 12 present, missing appended in preset order
- `sectionOrder` containing a duplicate → deduped
- `heroStyle`/`layoutStyle` outside their registries → the business's current value; and `HERO_STYLES`/`LAYOUT_KEYS` are **set-equal** to `lib/hero-style.ts`'s `HERO_STYLE_KEYS` (8 entries) and `lib/site-layout.ts`'s preset keys (5), so a new hero can never be silently unreachable
- **`heroFill: "flat"` with `ctx.heroStyle: "aurora"` → forced to `"gradient"`.** The theme rule is (0,4,1) with `!important` and **beats** aurora's own (0,3,1) block, and `heroFill` is a required schema field so the model emits it every time (§C.2).
- **`heroOverlay: 55` with `ctx.hasHeroImage: false` → forced to `0`**
- **all four un-hide guards** (§H.3): `sectionsHidden: ["store"]` + `siteMode: "store"` → `store` removed; `["contact"]` + `contactEnabled` → removed; `["booking"]` + booking days → removed; a 7-key `sectionsHidden` → capped at 4
- `null` input → `DEFAULT_DESIGN`, deep-equal to the "no design" state

### `tests/storefront-brand.test.ts` (unchanged assertions)

Add a comment only, at the surface-hex list (`:107`), recording that these remain the *unthemed* surfaces and that themed surfaces are covered by `auditContrast`. **No assertion changes** — the CTA-ink pin at `:118-124` must keep passing, which is exactly why `tier-styles.tsx:465` is on the do-not-tokenise list. **Owned by P3**, so this file has exactly one writer like every other.

### Manual verification checklist (browser; there is no Playwright and none is being added)

1. All 9 published storefronts, before/after, on desktop + 390px: parity script clean.
2. A business with `design_live = '{}'` renders identically with the studio deployed.
3. Studio: change every one of the 32 tokens; preview updates with no reload.
4. **Drag every one of the 12 sections and confirm the preview DOM order matches the inspector list** — the reorder is `insertBefore` on `[data-sec]` wrappers, not CSS `order` (§E.5). Then do one move with Tab + ArrowUp and confirm the Hebrew `aria-live` string fires with the **visible** count.
5. Set `surfaceBase` to `#ffffff`, confirm three amber notices, press **תקנו לי**, confirm zero notices.
6. Publish with a deliberately failing contrast and confirm the toast reports the auto-corrections and the live site is readable.
7. Unpublished business: preview renders; open the same URL in a private window and confirm **404**. Then **sign out and reload the preview URL in the same browser** and confirm 404 — the token is bound to the user (§E.2).
8. Let the cookie lapse and confirm the studio surfaces the Hebrew reconnect card within ~8s and that retry restores the preview.
9. Store with 0 categories: no rail, no empty column, chip row absent — pixel-compare against the pre-change screenshot. Then a **one-level** tree at 375px: chip row pixel-identical to today. Then add a child and confirm the sheet trigger replaces it.
10. Rename a category and confirm `products.category` followed (`select category from products where category_id = …`).
11. Delete a parent category and confirm products survive with `category_id is null`.
12. Landing-mode business: מקטעים tab hidden, **only `headingFont` and `bodyFont` enabled**, and confirm no `<style>` from `ThemeStyle` is present in the landing DOM at all.
13. iPhone-width real device: two-mode studio, ▲/▼ reorder, ↶/↷ in the bottom bar, sticky publish bar above the home indicator.
14. **A `story`-layout business with a hero image**: set a slot order on `about`, confirm the two-column split survives on desktop (§D.4).
15. **Theme a store to a light ground, then click through to a product page and the blog** — all three must be light, not black (P11).
16. **An `aurora`-hero business**: generate a design, confirm the hero headline is unchanged and that `data-hero-fill` is absent from the root div.
17. **A themed site with `sectionRhythm: "normal"`**: confirm the reviews block's height is unchanged from the baseline screenshot.
18. **Undo across a reload**: make 5 changes, reload the studio, press ↶ five times, confirm it walks back through all of them.

---

## K. Risks + non-goals

### Risks (each with the mitigation that is actually in this spec)

| # | Risk | Mitigation |
|---|---|---|
| 1 | **The cascade fact the whole engine rests on.** Tailwind lives in `@layer utilities` (`node_modules/tailwindcss/index.css:1`); `TierStyles` and `ThemeStyle` are unlayered and therefore win. If `ThemeStyle` is ever emitted through a Tailwind plugin or wrapped in `@layer`, every rule silently loses and sites revert to white. | A test asserts `designToCss` output never contains `@layer`; a comment at the top of `theme-style.tsx` states the invariant. |
| 2 | **IACVT.** A malformed token does **not** fall back to the `var()` default — the declaration becomes invalid at computed-value time and resolves to inherit/initial, which can blank an entire surface. | Every value is validated server-side in `lib/site-design.ts` and **dropped**, never emitted, if invalid. Tested with junk hexes and injection strings. |
| 3 | **`sectionByKey` values are `false`/`undefined`, not `null`** (the `x && <jsx>` idiom at `page.tsx:411, 540, 551, 573, 594, 668). Any consumer using `!== null` renders `false` slots. | The rewritten `orderedSections` uses `if (!node) return null` — truthiness — and the spec calls it out inline. |
| 4 | **`display:contents` on the ordered wrapper.** Giving it any real box (padding, max-width, `position`, or a grid parent) clips full-bleed backgrounds to 56rem and breaks sticky children. | `className="contents"` is preserved in **both** branches of the new wrapper; stated as a hard invariant in P6. |
| 5 | **`[data-condensed]` depth sensitivity.** The selectors reach `[data-el="module-section"]` at depth 1–2 only; `modulesSection` sits at depth 3 and is silently not narrowed under `compact`/`express`. | The new wrapper adds exactly the depth the old one added. The quirk is preserved deliberately, not fixed — fixing it would change `compact`/`express` sites. |
| 6 | **7 of 8 heroes override the tier h1** with their own blocks — but at **(0,3,1)**, which the theme's `[data-tier][data-design][data-hero-fill="flat"] [data-el="hero"] h1` at **(0,4,1) + `!important`** BEATS. Revision 1 had this backwards and treated a greyed-out control as sufficient; `heroFill` is a required schema field, so the AI emits it on every generation. | Three layers: `page.tsx` stamps `data-hero-fill` **only when `hero_style === "orbit"`** (server-side, survives a PostgREST PATCH); `clampDesignSystem` forces `heroFill = "gradient"` for non-orbit; the control is disabled with a Hebrew tooltip. Same treatment for `heroOverlay`, gated on `hero_image_url`. No hero typography token ships. |
| 7 | **`btn-primary`'s `#0a0a0a` ink is load-bearing** and pinned by `tests/storefront-brand.test.ts:118-124`; `brandForDarkGround` exists to guarantee AA against it. | `:465` is on the do-not-tokenise list. `--t-btn-ink` is derived by `inkOn(accent)` server-side and is never owner-editable. |
| 8 | **CSS vars on `[data-tier]` do not reach React portals** — `MediaLightbox` (`public-store.tsx:192-197`), `CartDrawer`, `WishlistDrawer` all mount on `document.body` and are deliberately light-styled. | Non-goal for v1; documented below. `ThemeStyle` mirrors **only** `--t-accent` and `--t-radius-btn` onto `:root` so brand-coloured buttons inside portals stay consistent; nothing else. |
| 9 | **~30 unremapped `hover:` utilities** (`hover:bg-zinc-50`, `hover:text-zinc-800`, `hover:border-zinc-400`) sit inside remapped scopes. A light `surfaceBase` flips which of these are bugs. | The colour panel warns when `relativeLuminance(surfaceBase) > 0.45`: *"רקע בהיר עדיין בבדיקות — ייתכנו פרטים קטנים בצבע לא מתאים."* Light grounds are permitted but flagged. Fixing the 30 sites is a separate project. |
| 10 | **`logo_options` is at 2485/2500 output tokens (99.4%)** — one token from breaking, and it is the closest analogue to the new agents. | Both new agents go to `HEAVY_CAP` 8000, not LIGHT. `logo_options` itself is untouched (raising its cap is a separate, unrelated fix). |
| 11 | **Gemini thinking tokens are billed into `outputTokens`** and gated by `maxOutputTokens` together with the JSON; overflow yields `"No object generated"`, indistinguishable from a safety block. | Cap sized from measured thinking overhead, not schema size (§H.4). Both failure strings map to Hebrew messages; the agent degrades to `DEFAULT_DESIGN` rather than throwing. |
| 12 | **The Anthropic fallback is dead** (credit balance, last failure 2026-08-03). There is no real retry. | `DEFAULT_DESIGN` degradation; the studio is fully usable with zero AI. |
| 13 | **`.limit(24)` on the public product fetch** makes any rail built from `site.products` wrong. | The tree and counts come from a dedicated **uncapped** query (`getPublicCategoryTree`); the UI states `"מציג 24 מתוך 41"` rather than lying. **`getPublicSiteBySlug`'s limit and ordering are NOT touched** — revision 1 raised it to 60 and added a `created_at` tiebreak, which is itself a visible live change to product order (`sort_order` is all-zeros in production) and would have made P6's "parity run must be clean" unachievable *and* the P0 baseline non-deterministic. §G.3. |
| 14 | **`updateProduct`/`deleteProduct` have no tenant predicate** (`store.service.ts:70-83`) and rely purely on RLS, whose `with_check` only tests `products.business_id` — so an owner could attach another business's `category_id`. | The composite FK `(category_id, business_id) → store_categories(id, business_id)` makes it impossible at the DB level; the new `assignProducts` helper also filters on `business_id`. `updateProduct` itself is left alone (out of scope). |
| 15 | **Production already has near-duplicate categories** (`חולצות` + `חולצות וטופים` on one business). | The backfill creates both, deliberately. A test pins that they stay separate. Merging is an owner decision in the manager, never a migration's. |
| 16 | **Renaming a category could orphan products.** | Owned by a DB trigger (`sync_category_rename`), not by client code, so the CSV import and the AI product generator cannot drift either. |
| 17 | **Reading cookies in `app/s/[slug]/layout.tsx`** could make storefronts dynamic. | Verified free: `page.tsx:182` already calls `getCustomerUser()` → `createClient()` → `await cookies()`. The route is already dynamic. |
| 18 | **`frame-ancestors 'self'` breaks the preview if custom domains ship.** | The exact override recipe (second `headers()` entry after the global one; **remove** `X-Frame-Options`, don't modify it) is written in §E.6. |
| 19 | **`react-hooks/purity` is an ERROR.** `Date.now()` in a server component body is a hard build failure. Revision 1 specified exactly that in **both** `app/s/[slug]/layout.tsx` and `app/s/[slug]/page.tsx`, and claimed the mitigation was "`mintPreviewToken` takes `nowMs` as a parameter" — which does not help, because the impure **call site** is still in the render body. | The clock read lives in `readStudioSession()`, a lowercase non-component module-level helper in `lib/studio-preview.ts` (§E.3). **`Date.now()` must never appear in a component body in this project.** P0's `qa-gate` runs `npx eslint .` as a hard gate so this cannot land again. |
| 20 | **No git.** | P0's parity harness + the per-package backup lists + a down-path inside the migration file. Every package is independently applicable and independently verifiable. |
| 21 | **`types/database.ts` regeneration would erase ~100 aliases and every doc comment.** | Six hand-edits, spelled out in §B.2, with an explicit "never regenerate" instruction in P1. |
| 22 | **Two full-snapshot writes committing out of order** under fast dragging. | **Not** solved by blocking input — that was revision 1's `if (saving) return;` and it makes the editor feel dead (§F.2). Solved by keeping **at most one request in flight** and replacing the *queued* snapshot on every further gesture, plus the `modules-picker` identity-guarded revert on error. Ordering is guaranteed by the single-flight invariant, not by refusing the owner's drag. |
| 23 | **`websites.published` and `businesses.site_mode` are trigger-guarded** (42501 for non-service_role). | Verified: `assert_platform_controlled_write` fires only when those two columns *change*. No studio write touches either. |
| 24 | **`--radius` on `:root` (`app/globals.css:75`) drives the dashboard's whole radius scale via `calc()`.** | Every studio token is scoped to `[data-tier][data-design]`; nothing is written to `:root` except the two portal mirrors in risk 8. |
| 25 | **`ThemeStyle` is NOT the last unlayered stylesheet on the page.** 13 component-level `<style>` tags render after it (all 8 heroes, `hud-frame`, `marquee-band`, `statement-section`, `liquid-glass`). Revision 1 asserted the opposite in two places, and future work would have leaned on it. | Every theme rule wins on **specificity**, never on order. §J carries a specificity ledger asserting every hero-competing selector is strictly greater than (0,3,1). §C.1. |
| 26 | **Four routes render `data-tier` + `TierStyles`, not one.** Theming only `page.tsx` gives a themed homepage and a hard-black product page, blog list and blog post. | **P11** brings the three sub-routes to parity (`data-design` + `ThemeStyle` + `data-no-rhythm`). Not a regression against today, but shipping it silently would read as an oversight. |
| 27 | **Numeric tokens with no unit or a `NaN` are IACVT**, and IACVT resets the whole *shorthand* — a bare `--t-border-w` deletes every product-card border; a `NaN` radius squares every card. Risk 2's "validated and dropped if invalid" does not cover it: the value is a valid number and the **emission** is what is wrong. | Units are part of the `TOKENS` registry contract and only `emit` may append them; numbers are type-checked for finiteness **before** clamping, never coerced. §C.1b, §C.1c, with positive and negative §J assertions per unit kind. |
| 28 | **`safeHexColor` never fails** — it returns `#2563eb` — and it accepts 8-digit `#rrggbbaa`, whose alpha `contrastRatio` cannot see. Implemented as revision 1 described, a malformed ground turns a live storefront **blue**, and `inkBody: "#c9c9c900"` renders invisible text that passes the AA audit. | `safeDesignHex` in `lib/site-design.ts`: 3-or-6 digit only, normalised to 6, **`null` on failure so the caller drops the token**. `safeHexColor` is explicitly banned for design tokens and keeps its one correct call site. §C.1a. |
| 29 | **Category edits write to production immediately**, while the studio's entire promise is that nothing does until publish. | The category manager is **removed from the studio** and lives only on the חנות screen, with a permanent live-write banner and per-action confirms. §F.2, §G.1. |
| 30 | **A preview token bound to a business but not a session** leaves an unpublished draft readable for its whole lifetime after sign-out, and survives a team member losing access or a business transfer. | The signed payload includes `userId`; the storefront requires a match against the auth user it **already resolves** (`getCustomerUser` ≡ `getUser`, same round trip). `maxAge` cut to 900s with a 10-minute heartbeat re-mint and a `DELETE` on unmount. §E.2. |

### Explicit non-goals (v1)

- **Free-canvas absolute positioning.** Settled by the lead; the studio is structured by design.
- **Element-level reordering beyond the named slot registry.** Arbitrary child reordering inside a section is not offered.
- **Theming the three portalled surfaces** (`MediaLightbox`, `CartDrawer`, `WishlistDrawer`). They are deliberately light-styled today (`public-store.tsx:62-63`) and stay that way.
- **Unifying the 8 hero files' typography.** Every hero owns its own `!important` h1 block; touching all 8 together is its own project.
- **Fixing `sharedCss:37`'s focus-ring `border-radius` bug.** Real, known, out of scope — tokenising it would bake it in.
- **Fixing the 30 unremapped `hover:` utilities.** Needed before light grounds are fully supported; flagged in the UI instead.
- **Reviving the `standard` / `advanced` tiers.** `resolveDesignTier` (`lib/design-tier.ts:45-52`) hard-returns `"professional"`; re-enabling tiers would suddenly light up `bandSection`, all four `SectionDecor` mounts and `StatementSection` on every site.
- **Making the product-page category breadcrumb a link.** Its two-step resolution path makes it a v2 item.
- **Category-filtered server-side pagination.** v1 filters the loaded set client-side and tells the truth about the count.
- **`subcategory` backfill.** One live row; deliberately left alone (§B.1).
- **A `job_type` enum value for design generation.** Not needed for a synchronous, watched call.
- **Playwright / E2E.** Not installed. `docs/TECHNICAL_MASTERPLAN.md:807-813` lists it aspirationally; do not write a plan that assumes it exists.
- **Custom domains.** Would break the preview; the fix is documented but not implemented.
- **Per-business breakpoints.** `var()` is not allowed in an `@media` prelude; per-business media queries would mean per-business stylesheets.
- **Inline text editing inside the preview.** Site copy has no draft column; see §L.4.

---

## L. תשובות לביקורת

Three hostile reviews (regression / security / product-UX) produced **49 findings**. Every one is listed here with a verdict and the section that carries the change. Nothing was waved away; the findings whose *suggested fix* was rejected each state what was done instead and why the code supports it.

Verdicts: **מתוקן** = the design changed as suggested · **מתוקן אחרת** = the defect is real, the fix is different and better · **מתוקן חלקית** = part of the suggestion is deliberately not shipped, justified in §L.4.

### L.1 Regression review (findings 1–15)

| # | verdict | where | note |
|---|---|---|---|
| 1 — `Date.now()` in two server component bodies | **מתוקן** | §E.3, §K risk 19, P0 | The clock read moved into `readStudioSession()`, a lowercase module-level helper. The reviewer's eslint proof is quoted in §E.3 so nobody re-runs it. `qa-gate` now runs `npx eslint .` **first**, which is what makes this class of finding unlandable rather than merely documented. |
| 2 — `sectionRhythm: normal` double-pads three sections | **מתוקן אחרת** | §C.2, §J | The reviewer offered (a) don't emit at `normal` **or** (b) `:not([data-no-rhythm])`. **Both were taken**, because they fix different bugs. (a) fixes `normal`; (b) fixes `compact`/`airy` too — the reviews wrapper (`page.tsx:660`) has no padding of its own and its child `site-reviews.tsx:44` is `py-16`, so it double-pads at *every* rhythm value. Taking only (a) would have left a real defect at the two non-default values. §J's old "assert the rule is unconditional" assertion is deleted and replaced by its opposite. |
| 3 — `heroFill` outranks the 7 hero blocks; premise was inverted | **מתוקן** | §C.2, §H.3, §D.4, §K risk 6 | Both suggested changes taken, plus a third: `page.tsx` stamps `data-hero-fill` **only when `hero_style === "orbit"`**. That is the one layer that survives a hand-crafted `design_live` PATCH, which neither the clamp nor a greyed-out control does. Same treatment for `heroOverlay`, gated on `hero_image_url`. |
| 4 — slot rule collapses the `story` split-about | **מתוקן** | §D.4, §D.2, §J | `sectionSlotsFor("about", { aboutVariant: "split", hasHeroImage: true })` returns `[]`, so **no rule is emitted at all**; `:not(.grid)` is a second independent belt. Re-verified this session: `page.tsx:433` gates the split on `aboutVariant === "split" && heroImg`, and `:434`'s grid is the section's sole direct child. |
| 5 — ThemeStyle is not the last stylesheet | **מתוקן אחרת** | §C.1, §D.4, §J, §K risk 25 | The corrected statement is adopted verbatim. The *alternative* — move ThemeStyle after `<SiteFooter>` — is **rejected**: a document-order guarantee is worthless here, because the 8 hero `<style>` tags are emitted by components that can re-render, and the tie that matters (heroFill vs. the hero `h1` blocks) has to be won on specificity anyway. Instead §J carries a **specificity ledger** asserting every hero-competing selector is strictly greater than `(0,3,1)`. Order is designed out, not fought. |
| 6 — four "default = today's literal" claims are false | **מתוקן אחרת** | §C.2, §J | The reviewer offered "split the tokens" or "delete the default column". Splitting gives the owner four hairline sliders nobody wants; deleting the column hides the problem. Those tokens instead emit a **derived ramp** — one control, several variables, ratios chosen so `emit(default)` reproduces every literal exactly (`hairlineStrength` → `.06/.08/.10/.12` at N=10; `revealDistance` → `32/26/24px` at D=32). Only `inkStrong` and `inkMuted` genuinely unify (3% spread) and are named in a `UNIFIES` allowlist §J asserts contains exactly those two. The reviewer's second half — kill per-token "reset to default" — **is** adopted: the only revert is §F.4's `design_draft = {}`. |
| 7 — `bodyFont` can never take effect; §F.6's landing claim is wrong | **מתוקן אחרת** | §C.2, §F.6 | The suggested `fontFamily: var(--t-font-body, …)` works but leaves a CSS variable inside a JSX `style` object with one consumer, and does nothing for landing. Both font tokens are instead **resolved on the server** (`effectiveBodyFont` / `effectiveHeadingFont`), which removes the specificity fight entirely and works identically in the landing branch (`page.tsx:274`/`:298`) — which is exactly why fonts are the only two tokens landing gets. The `radiusButton`/`buttonWeight` claim is deleted, as demanded. |
| 8 — title overrides have no server render path | **מתוקן** | §D.4, P4, P6, §J | Rendered as a React text child at seven verified addresses (table in §D.4, all re-derived by grep this session). The preview mutates **only the last text node**, so `public-store.tsx:381`'s `<ShoppingBag>` survives. §J asserts `designToCss` never emits `content:`. |
| 9 — no unit serialisation contract | **מתוקן** | §C.1c, §J, §K risk 27 | `unit` is part of the `TOKENS` entry and only `emit` may append it. §J carries the positive assertion and the negative list, including that `--t-grid-cols` and `--t-hero-overlay` stay unitless. |
| 10 — `safeHexColor` never fails | **מתוקן** | §C.1a, §J, §K risk 28 | `safeDesignHex` returns `null` and the caller drops the token. `safeHexColor` is explicitly banned for design tokens and keeps its one correct call site. |
| 11 — P5's product limit/order change breaks the parity claim | **מתוקן אחרת** | §G.3, P5, §K risk 13 | The reviewer offered "land it before P0" or "don't change it". **The second was taken**: the first still ships a visible, unannounced change to product order on 9 live sites for no benefit here, because the rail's counts come from the uncapped `getPublicCategoryTree`, not from `site.products`. `.limit(24)` and `.order("sort_order")` are untouched and the arbitrary ordering is recorded as a pre-existing bug in the non-goals. Only `getDraftSiteByBusinessId` — no public reader — uses `.limit(200)`. |
| 12 — 4 routes render `data-tier`, only one gets `data-design` | **מתוקן אחרת** | **P11** (new package), §K risk 26 | The defect is fixed: the three sub-routes get `data-design` + `<ThemeStyle>` + `data-no-rhythm`. The suggested `<SiteThemeRoot>` extraction is **rejected** — it puts four files into one package's blast radius (breaking the partition that makes parallel implementation safe) for ~8 duplicated lines, and `page.tsx`'s root additionally carries the `effectiveBodyFont` inline style and the hero gate, so the shared component would need two escape hatches immediately. Documented in P11 as a decision. |
| 13 — `contentWidth` is inert on 3 of 5 layouts | **מתוקן** | §C.2 | Disabled with a Hebrew tooltip when `hints.condensed === false`. Re-verified: `condensed: true` exists only at `lib/site-layout.ts:139` (compact) and `:160` (express). The widening alternative is a §K non-goal — it means overriding nine hard-coded containers, re-listed with verified line numbers in §C.2. |
| 14 — `sectionsHidden` guards only rescue `store` | **מתוקן** | §H.3, §J | All four un-hide guards plus a cap of 4, with matching cases in `tests/design-system-agent.test.ts`. |
| 15 — citation drift | **מתוקן, and the reviewer under-counted** | §C.3, §I pre-flight, §D.4 | The `508`/`509` split is fixed and re-verified by `grep -n`. Re-deriving the rest surfaced **six more** drifts of the same shape, all corrected and tabulated in §I's new *Citation hygiene* block. The `page.tsx:821` edit moved into §D.4 with the other insertions, P6 item 13 now says "tokenise both, keep their distinct fallbacks", and the header-CTA fixed sizing is documented under the Buttons table. |

**Confirmed non-issues, pinned so they are not re-opened.** There is **no authored `@media print`** anywhere (only Tailwind build output), so print is not a consideration. `sharedCss:54-61`'s `prefers-reduced-motion` block stays unlayered with `!important` and still wins, so `motionSpeed` can never override a visitor's accessibility preference — and §C.3 forbids tokenising it. The professional tier's utility-class remap (`:390-403`) is safe because those **selectors** are untouched and only their **values** are wrapped.

### L.2 Security review (findings 16–34)

| # | verdict | where | note |
|---|---|---|---|
| 16 — `store_categories.parent_id` cross-tenant IDOR | **מתוקן** | §B.1, §G.2 | The self-FK is composite `(parent_id, business_id) → (id, business_id)`, the same shape already applied to products. `moveCategoryAction` additionally loads the target parent through the RLS client and rejects a null with a Hebrew error. |
| 17 — `deleteCategory` specified against a revoked privilege | **מתוקן אחרת** | §B.1, §G.2 | Option **(a)** taken: DELETE is **not** revoked. The 0085 rationale (delete+re-insert bypassing a platform-controlled column) does not apply — this table has no privileged column and the RLS policy is `for all`. Option (b) would have pushed `deleteCategory` onto `createServiceRoleClient()`, i.e. onto the exact `.eq("id", …)`-only shape `store.service.ts:70-83` already gets wrong. All six category actions now carry the four-step guard chain, spelled out in §G.2 rather than listed by name. |
| 18 — HMAC secret can be an empty string | **מתוקן** | §E.2, §J | `||` not `??`, module scope, `length < 32` throws, and a test asserts the module throws at import with the env unset. |
| 19 — `timingSafeEqual` throws on length mismatch | **מתוקן** | §E.2, §J | `verifyPreviewToken` is total: strict regex parse first, byte-length compare before `timingSafeEqual`, whole body in `try/catch`. A **wrong-byte-length** case is added, since the tamper case uses a same-length mutation and misses it. This runs on every anonymous request to every live storefront, so totality is not optional. |
| 20 — the migration re-grants `anon` | **מתוקן** | §B.1 | `revoke all … from anon;` then a narrow grant to `authenticated` only. The comment now says the block **narrows** a real default instead of claiming to be belt-and-braces, and cites the 0076 lineage. (The DELETE half differs from the reviewer's draft because of finding 17; the reason is in the migration.) |
| 21 — 8-digit hex bypasses the WCAG guarantee | **מתוקן** | §C.1a, §C.4, §J | `safeDesignHex` rejects 8-digit outright. §C.4's guarantee is restated honestly: it holds for everything written through `publishDesignAction`, and the **read-side `resolveDesignConfig` is the real security boundary** — which is true and is what makes a PATCHed `design_live` unable to do worse than look bad. |
| 22 — `safeHexColor`'s `#2563eb` fallback | **מתוקן** | §C.1a, §J | Drop-on-invalid. §J asserts on the emitted **string** that no `--t-surface-0` declaration exists, so a blue substitution fails the test. |
| 23 — no finiteness guard on numbers | **מתוקן** | §C.1b, §J, §K risk 27 | Type check **before** clamp; `"5"`, `NaN`, `Infinity`, `{}`, `[]` are dropped, never coerced. One §J case per unit kind. |
| 24 — AI routes have no auth, no rate limit, no concurrency guard | **מתוקן** | §H.1 | The full chain is in the spec: `getUser()` + 401 → `getBusiness()` on the RLS client + 404 → hourly `checkRateLimit` → a 1-per-60s in-flight lock replacing the job row the design deliberately removes. |
| 25 — the preview cookie is a session-less bearer credential | **מתוקן** | §E.2, §K risk 30 | The "cheapest correct fix" taken in full: `userId` is in the signed payload and the storefront requires a match. It costs **zero** extra round trips — `getCustomerUser()` is byte-for-byte `getUser()` and `page.tsx:181` already calls it inside the existing `Promise.all` (verified this session by reading `lib/auth/customer.ts`). `maxAge` also cut 1800 → 900 with a heartbeat re-mint and a `DELETE` on unmount. |
| 26 — the bridge applies an unvalidated payload | **מתוקן** | §E.5, P5 | `resolveDesignConfig(msg.design)` before `designToCss`, and `styleEl.textContent` — `innerHTML` / `insertAdjacentHTML` / `document.write` are named and forbidden. |
| 27 — `title` invites a CSS `content:` implementation | **מתוקן** | §D.4, §J | Server-rendered React text child, with an explicit prohibition and a §J assertion that output never contains `content:`. |
| 28 — no path for the font tokens; raw interpolation risk | **מתוקן** | §C.2, P6 | Server-resolved (finding 7), and `fontsHref` gains the token families **behind a runtime `HEBREW_FONTS.includes(f)` check** — the core point that the allowlist's ASCII-safety must be a check, not a comment. `page.tsx:833`'s `brand_assets` interpolation is untouched. |
| 29 — the layout bypass reintroduces the soft-404 | **מתוקן אחרת** | §E.3 | Gated on a **match**, not on the cookie's presence: the basics lookup is never skipped, and `getPublicSiteBasicsBySlug` now returns `{ mode, businessId }` (it already selects `business_id` at `website.service.ts:92` and discards it — verified). The "simpler" alternative (drop the bypass, let a never-published slug 404) is rejected because §E.1 keys the iframe on `business.id` when no slug exists; `slug === session.businessId` is the first arm of `isOwnDraft`, so the case the reviewer said needed an explicit decision now has one. |
| 30 — `design_draft` is read on every public request | **מתוקן** | §E.3, §B.1 | The better of the two options taken: `getPublicSiteBySlug` gets an **explicit column list + `design_live`**, enumerated from `types/database.ts` so nothing is silently omitted, and the column comment is reworded to match reality. `websites` was the last `select("*")` in that function. |
| 31 — `frame-ancestors 'self'` means storefront ≡ dashboard origin | **מתוקן** | §E.6 | No `next.config.ts` change, as the reviewer concluded. The **standing rule** is added in 0085's voice: no owner-supplied HTML or JS may ever render under `/s` on this origin, and the pixel/GTM feature anticipated at `next.config.ts:10-13` requires a separate origin first. The `sandbox` dead end is documented so nobody proposes it. |
| 32 — `preview-session` uses `requireUser()` and has no Origin check | **מתוקן** | P5 | `getUser()` + explicit 401 (the repo's route-handler convention), `getBusiness()` for ownership, and an explicit `Origin` check against `NEXT_PUBLIC_APP_URL` before minting. |
| 33 — no `revoke execute` on the two trigger functions | **מתוקן אחרת** | §B.1 header | The reviewer's own assessment — "not a hole" — is confirmed: both return `trigger`, so PostgREST cannot expose them, and both are SECURITY INVOKER. The **documentation** half is taken in full, including the warning that converting `sync_category_rename()` to SECURITY DEFINER would make its `new.business_id`-scoped UPDATE a cross-tenant write primitive. The **optional revokes are declined**: no trigger function in this repo carries one, so adding two creates an unmaintained precedent that reads as if trigger functions were reachable. If a future reviewer disagrees it is a two-line change and the header says where. |
| 34 — publish is available to any active member | **מתוקן** | §F.5 | Made an explicit decision: publish is **owner/admin-only**, mirrored in TypeScript against `business_members` on the RLS client (not via the SQL helper, whose EXECUTE `0085:124` revoked from `public`/`anon`). Staff keep the whole studio including the draft. The member-inclusive `store_categories` policy stays as-is and §F.5 says so. |

### L.3 Product / UX review (findings 35–49)

| # | verdict | where | note |
|---|---|---|---|
| 35 — instant drag-reorder cannot work as specified | **מתוקן** | §D.4, §E.5, §J | All three compounding facts were right. `data-sec` is now **unconditional** under a design or studio mode, and reordering is `parent.insertBefore(wrapperEl, refEl)` on the `[data-sec]` wrappers — no flex container, no `order`, correct through `display: contents`. Hide/show stays `display: none`, which does override `contents`. §J asserts the wrapper predicate is true for all 12 keys regardless of `props`; manual check 4 drags all 12. |
| 36 — "move the icons and the texts" is not delivered | **מתוקן חלקית** | §D.2, §D.4, §A, §F.2, §L.4 | (a) **taken**: `sectionSlotsFor` resolves per-variant and the iframe's `ready` message reports the `[data-slot]` nodes that actually exist, so a toggle for an absent node is greyed out — two independent sources agreeing. (c) **taken**: `BENEFIT_ICONS`, a closed 12-name lucide registry, per benefits card, defaulting to today's `CheckCircle2`. (d) **taken**: the "we won't let you break your site" line is a permanent footer under the inspector tabs, not never-rendered empty-state copy. (b) inline text editing is **rejected for v1** — §L.4. |
| 37 — category edits write live inside a draft/publish surface | **מתוקן** | §F.2, §G.1, §A, §K risk 29 | The "better fix" taken: the manager is **removed from the studio** entirely and lives on the חנות screen with a permanent live-write banner and per-action confirms. §A's story — the spec's own counter-example — is rewritten. "Nothing except פרסום העיצוב changes the live site" is now literally true. |
| 38 — the mobile rail is a wrapping chip blob | **מתוקן** | §G.3 | Exactly as suggested, including the split that preserves byte-identity: a **one-level tree keeps today's chip row verbatim** (covering every store that exists, since the backfill creates roots only), and a tree with children gets a bottom sheet. Desktop gets `max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain` and collapses non-active roots. |
| 39 — undo evaporates on reload, no redo, none on mobile | **מתוקן** | §F.4, §F.7 | Persisted ring of 20 snapshots at `design_draft.undo` (sibling of `history`), bounded by a 64 KB serialised cap, plus redo on `Ctrl+Shift+Z` / `Ctrl+Y`, plus ↶/↷ in the mobile sticky bottom bar. Manual check 18 walks undo across a reload. |
| 40 — the AI is thin and its failure path locks the owner out | **מתוקן אחרת** | §H.2, §H.5, §F.2 | (a) **taken with one change**: `heroStyle` and `layoutStyle` join the schema, but the **route does not write them to `websites`** — they are stored under `design_draft.chrome` and applied to the real columns by `publishDesignAction` only. Writing them at generation time would make the AI's most visible choices bypass the draft/publish story, which is the safety property the whole feature rests on; the preview sees them through `getDraftSiteByBusinessId`'s overlay instead. (b), (c), (d) **taken verbatim**: `design_generated_at` is written **only** on genuine agent success, degrading shows a Hebrew card with a retry button, and the variant chips sit above the button with the remaining budget shown from the first click. |
| 41 — 32 tokens: overwhelming *and* too weak | **מתוקן חלקית** | §F.2, §F.7, §L.4 | Presets first (6 complete looks + up to 3 AI variants) as the default panel; 14 designer knobs demoted behind a **מתקדם** accordion on desktop, mirroring mobile; hero imagery reachable via a deep link to the existing logo+hero studio rather than a duplicated control. The light-ground half is partly addressed — §L.4. |
| 42 — slot CSS collapses the story split | **duplicate of 4** | §D.4, §J | Same fix. Two independent reviewers finding it raised it from "possible" to "must have a test", which §J now carries. |
| 43 — per-section alignment lands half-applied | **מתוקן אחרת** | §D.2, §D.4 | The reviewer offered "emit `justify-content` too" or "gate the control". **Gating is taken** (`ALIGN_CAPABLE` = `about`, `services`, `faq`, `contact`), **plus** the rule targets `[data-el="section-title"]` explicitly, because those headings carry their own `text-center` utility a parent rule cannot reach (`page.tsx:465`, `:500`, `:577` — re-verified). Emitting `justify-content` blind would have re-broken the flex-centred store title and chip row the reviewer correctly identified; `store` is deliberately **not** align-capable. |
| 44 — the 30-minute cookie has no refresh and no recovery | **מתוקן** | §E.5, §E.2 | Re-mint on a 10-minute interval — not 20, because the cookie is now 900s and 20 would leave a 300s hole — and on `visibilitychange`, plus an **8-second `ready` timeout** in `preview-frame.tsx` that surfaces the Hebrew reconnect card. That card is now specified, not merely referenced by a manual test. |
| 45 — RTL drag: axis right, affordance wrong | **מתוקן** | §E.4, §F.2, §E.3, §F.3 | `rects` carries `left` and `width`; the overlay draws a full section outline plus a chip on a solid backplate inside it; `WhatsAppFloat`, the `.float-btn` fallback and `AnnouncementBar` join the studio-mode suppression list; and the `aria-live` string announces position among **visible** sections and says so. |
| 46 — blocking drags on an in-flight save feels dead | **מתוקן** | §F.2, §F.5, §K risk 22 | Input is never blocked. One request in flight, replace the queued snapshot, identity-guarded revert on error. Risk 22's mitigation is rewritten so it no longer contradicts this. |
| 47 — no Hebrew labels for the 12 section keys | **מתוקן** | §D.2, §J | `SECTION_LABELS` with `{ label, hint }`, using descriptions for the three opaque keys, exhaustiveness asserted with the `tests/site-mode.test.ts:36-40` pattern, and the hint rendered as the inspector row's subtitle. |
| 48 — the publish dialog promises an unrenderable thumbnail | **מתוקן** | §F.5 | Replaced by a plain-Hebrew change list diffed from `design_draft` vs `design_live`, plus the contrast-correction count step 4 already returns. The observation that both frames would send the `path: "/s"` cookie is what closes the last escape route. |
| 49 — the studio opens on the wrong tab | **מתוקן** | §F.2 | **מראה** is the default panel and carries the preset row, the AI's name and rationale, and the four controls that actually change how a site feels. מקטעים is second. |

### L.4 The two partial rejections, in full

**36(b) — inline text editing of headings and body copy. Rejected for v1.**

The reviewer is right that clicking a heading in a live preview and typing is what a Wix-class editor does, and right that "move the texts" reads as broken without it. It is rejected anyway, for a structural reason rather than a budgetary one.

Site copy does not live in `design_draft`. It lives in `websites.page_home` / `page_about` / `page_services` / `page_contact` / `page_faq` as generated jsonb, and it has **no draft column** — the תוכן tab on the website screen writes it straight to the live row. Wiring inline editing into the studio would therefore either (i) make the studio's headline promise false in a second place, since typing in the preview would hit production while every slider next to it stayed in a draft — the exact defect finding 37 was filed for, re-introduced through another door; or (ii) require a `page_*_draft` mirror for five columns plus a merge on publish, which is a larger data-model change than the entire token system and would land inside a package that already owns `page.tsx`.

What ships instead: the **`title` override** for the six `TITLE_EDITABLE` sections (real, server-rendered, publishable — finding 8), the **benefit icon picker**, and a **ערכו טקסטים** deep link on every inspector row that opens the website screen's תוכן tab for that section. The owner is never left wondering where the text is edited. A `page_*_draft` mirror is the honest v2 item and is in the non-goals.

**41 — light grounds. Partially addressed, deliberately.**

The reviewer asked to either fix the ~30 unremapped `hover:` utilities or hand-author and verify 2–3 light presets so that "light" is a one-click product decision. Neither is done. What ships is **one** preset labelled **"בהיר (ניסיוני)"** carrying the warning inline, plus five dark ones.

The two halves of the suggestion are not independent: hand-authoring three light presets *without* fixing the hover utilities ships three subtly broken looks instead of one flagged one, and multiplies the surface a support conversation has to cover. Fixing the utilities is a real project — auditing every `hover:bg-zinc-50` / `hover:text-zinc-800` / `hover:border-zinc-400` inside a remapped scope across the storefront, with its own parity run — and it touches files this feature's partition assigns to three different packages. Doing it inside the design studio would break the partition that makes parallel implementation safe at all.

So: light grounds are **permitted, flagged, and singular** in v1; the colour panel warns whenever `relativeLuminance(surfaceBase) > 0.45`; and "fix the 30 hover utilities" stays an explicit non-goal with the note that it is the prerequisite for shipping light as an equal option. The underlying complaint — that the studio's honest offer is "a slightly different black" — is answered by the other three levers instead: whole-design presets, the AI now choosing `heroStyle` and `layoutStyle` (finding 40), and the hero-image deep link.

### L.5 What the reviews changed about the shape of the work

Three structural consequences, because they are what an implementation agent will actually feel:

1. **A new package, P11.** Finding 12 turned "theme the storefront" into "theme all four routes that render `data-tier`". Small, but not optional — without it a themed store has a black product page.
2. **P0 is a gate, not a convenience.** Finding 1 was a build-breaking error that would have reached two packages. `qa-gate.mjs` running `npx eslint .` before `tsc` and `vitest`, on every package handoff, is the mechanism that makes spec bugs of that class unlandable.
3. **The category manager left the studio.** Finding 37 removed a whole tab from P7 and removed P7's dependency on P10, which is why P10 sits in wave 3 rather than blocking wave 4.
