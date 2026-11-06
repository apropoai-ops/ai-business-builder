-- 0087 — rental units get a photo gallery instead of one photo.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.
--
-- ── Why ─────────────────────────────────────────────────────────────────────
-- rental_units carried a single image_url (0.. one photo per צימר). Nobody
-- books a vacation rental off one picture — the owner needs to show the
-- bedroom, the pool, the view. Products already solved this exact problem in
-- 0012 with `images text[]` alongside `image_url`, so this copies that shape
-- rather than inventing a second one:
--
--   images    text[]  ordered gallery, index 0 is the cover
--   image_url text    kept as the cover mirror
--
-- image_url is deliberately NOT dropped. It is read by the owner list
-- thumbnails and by anything that only wants one URL, and keeping it means
-- this migration cannot break a render path that has not been updated yet.
-- The write path (saveUnitAction) now always sets image_url = images[0].
--
-- ── Grants ──────────────────────────────────────────────────────────────────
-- Checked before writing this (the 2026-08-04 blind spot in
-- project_security_posture): rental_units carries a TABLE-level grant
--   authenticated=arwdDxtm/postgres
-- with no column list — identical to products. So `images` is client-writable
-- the moment it exists and needs no follow-up grant. RLS still scopes the row
-- to the owning business via is_business_owner(). Verification query in §3.
-- ────────────────────────────────────────────────────────────────────────────


-- ══ 1. The column ══════════════════════════════════════════════════════════

alter table public.rental_units
  add column if not exists images text[];


-- ══ 2. Backfill ════════════════════════════════════════════════════════════
-- Every unit that already has a photo starts life as a one-photo gallery, so
-- the owner UI and the storefront read the same source from the first render.
-- Idempotent: the images is null guard means a second run updates zero rows.

update public.rental_units
set images = array[image_url]
where images is null
  and image_url is not null
  and btrim(image_url) <> '';


-- ══ 3. Verification ════════════════════════════════════════════════════════
-- (a) Expect zero rows. Any row = a unit with a cover that is not in its
--     gallery, i.e. the backfill missed it.
--       select id, name, image_url, images
--       from public.rental_units
--       where image_url is not null and btrim(image_url) <> ''
--         and (images is null or not (image_url = any(images)));
--
-- (b) Expect true. Any false = the owner's save will silently drop images.
--       select has_column_privilege('authenticated', 'public.rental_units',
--                                   'images', 'UPDATE');


-- ── Down ────────────────────────────────────────────────────────────────────
-- Lossy: dropping the column discards every photo past the cover. image_url is
-- untouched by this migration, so the pre-0087 single-photo behaviour returns
-- intact on its own.
--   alter table public.rental_units drop column if exists images;
-- REVERT THE CODE TOO — saveUnitAction and RentalBooking both read `images`.
