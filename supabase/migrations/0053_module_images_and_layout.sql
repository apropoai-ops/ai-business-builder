-- 0053: optional image per module content item + site-wide structural layout
-- Every storefront module gains an optional image; websites gain a layout_style
-- (structural arrangement of the public site, independent of hero_style/colors).

alter table public.pricing_plans add column if not exists image_url text;
alter table public.events add column if not exists image_url text;
alter table public.faqs add column if not exists image_url text;
alter table public.job_openings add column if not exists image_url text;
alter table public.process_steps add column if not exists image_url text;
alter table public.stats add column if not exists image_url text;
alter table public.memberships add column if not exists image_url text;
alter table public.downloads add column if not exists image_url text;
alter table public.donations add column if not exists image_url text;
alter table public.branches add column if not exists image_url text;

alter table public.websites
  add column if not exists layout_style text not null default 'flow';
