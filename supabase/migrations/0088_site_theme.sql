-- 0088 — websites.theme: the storefront's COLOUR SCHEME.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.
--
-- Until now the (only reachable) "professional" design tier hard-coded a pure
-- black page in components/public/tiers/tier-styles.tsx. Every site we shipped
-- came out the same black, whatever the trade. The scheme registry lives in
-- lib/site-theme.ts; this column is where a business's pick is stored.
--
-- Free text with no CHECK constraint, exactly like the sibling websites.hero_style
-- (0045) and websites.layout_style (0053): the valid set changes in TypeScript as
-- schemes are added or retired, and resolveSiteTheme() falls back to 'midnight'
-- for any value it doesn't recognise — so a stale key degrades to the previous
-- look instead of taking a customer's live site down.
--
-- 'midnight' reproduces the old palette value-for-value, so DEFAULTing every
-- existing row to it is a genuine no-op: every site already live renders
-- identically after this migration until somebody deliberately picks otherwise.

alter table public.websites
  add column if not exists theme text not null default 'midnight';

comment on column public.websites.theme is
  'Storefront colour scheme key — see lib/site-theme.ts (SITE_THEMES). Free text; unknown values resolve to midnight.';

-- ── Write path ──────────────────────────────────────────────────────────────
-- Deliberately NOT platform-controlled. websites carries a table-level grant to
-- authenticated and the owner policy is FOR ALL, so this column is writable by
-- the owner's own RLS client through upsertWebsite() — which is what we want:
-- the colour of your own site is a design choice, not a paywalled capability
-- (contrast businesses.site_mode / websites.published, which 0085 locked behind
-- trg_guard_publish precisely because they ARE revenue). That trigger keys on
-- the `published` column only and lets this one through untouched.


-- ── Down ────────────────────────────────────────────────────────────────────
--   alter table public.websites drop column if exists theme;
--
-- Safe to drop unconditionally: nothing references it, and the renderer
-- defaults to 'midnight' when the value is absent.
