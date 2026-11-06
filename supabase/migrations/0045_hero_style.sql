-- ============================================================================
--  Migration 0045 — selectable storefront hero style. websites.hero_style is
--  one of classic / vault / sentinel / liquid / convix; the public site renders
--  the matching hero template (all driven by the business's brand color).
--  Applied via MCP.
-- ============================================================================

alter table public.websites
  add column if not exists hero_style text not null default 'classic';
