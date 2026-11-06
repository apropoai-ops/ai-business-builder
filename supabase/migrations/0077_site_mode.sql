-- 0077: site build modes — one system, three modes.
--   'website' = אתר תדמית   (service business: pages, content, SEO, blog — no selling)
--   'landing' = דף נחיתה     (one conversion-focused page, pixels + countdown)
--   'store'   = חנות מלאה    (everything in 'website' PLUS the full commerce stack)
--
-- This single column rotates the whole pipeline: which AI agent writes the site,
-- which modules/sections render publicly, which dashboard nav items show, and
-- which public sub-routes exist at all.
alter table public.businesses
  add column if not exists site_mode text not null default 'website';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_site_mode_check'
  ) then
    alter table public.businesses
      add constraint businesses_site_mode_check
      check (site_mode in ('website', 'landing', 'store'));
  end if;
end $$;

-- Smart backfill for pre-existing businesses: anyone who already created a
-- product was building a store, so they keep every commerce surface they have
-- today. Everyone else becomes a brochure site. Nothing changes visually — the
-- gating packages that follow only ever REMOVE surfaces a mode doesn't use, and
-- 'store' keeps them all. Owners can switch mode manually afterwards.
update public.businesses b
set site_mode = 'store'
where b.site_mode = 'website'
  and exists (select 1 from public.products p where p.business_id = b.id);

create index if not exists idx_businesses_site_mode on public.businesses (site_mode);
