-- ============================================================================
--  Migration 0011 — AI Site Design (logo + hero images)
-- ============================================================================

do $$ begin
  alter type job_type add value if not exists 'site_design';
exception when others then null; end $$;

alter table public.brand_assets
  add column if not exists logo_url text;

alter table public.websites
  add column if not exists hero_image_url text;

-- Public storage bucket for generated site assets (logos, hero images).
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;
