-- 0094 — websites.hero_particles_enabled: per-site on/off for the
-- "professional" tier's particle-dust canvas + HUD corner labels overlay.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.
--
-- store-hero.tsx mounts ParticleField + HudFrame at the dispatcher level so
-- EVERY hero style gets them when tier === "professional" — including styles
-- like denim ("nothing floats, nothing parallaxes" by design) and vanguard
-- (already has its own dot-grid), where the extra drifting dust clashes with
-- the style's own signature rather than complementing it. This column lets an
-- owner turn the overlay off for their site without losing it platform-wide.
--
-- Defaults to true: every site currently live already renders with the
-- overlay on, so this migration is a no-op until an owner deliberately flips
-- it — same reasoning as websites.theme (0088).

alter table public.websites
  add column if not exists hero_particles_enabled boolean not null default true;

comment on column public.websites.hero_particles_enabled is
  'Whether the "professional" tier''s particle-dust + HUD-label hero overlay renders on this site. Owner-controlled, defaults to on.';

-- ── Write path ──────────────────────────────────────────────────────────────
-- Same as theme/hero_style/layout_style: a design choice, not a paywalled
-- capability, so it's writable by the owner's own RLS client through
-- upsertWebsite() — no service-role gate needed.


-- ── Down ────────────────────────────────────────────────────────────────────
--   alter table public.websites drop column if exists hero_particles_enabled;
--
-- Safe to drop unconditionally: nothing references it, and the renderer
-- treats an absent/undefined value as "on" (`!== false`), matching this
-- column's default.
