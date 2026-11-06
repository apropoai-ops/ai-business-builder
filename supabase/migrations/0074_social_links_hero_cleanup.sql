-- 0074: storefront social links + hero-style catalog cleanup
-- (A) Owner-managed social network links shown on the public site.
--     Shape: [{ "platform": "instagram", "url": "https://…", "enabled": true }, …]
alter table public.websites
  add column if not exists social_links jsonb not null default '[]'::jsonb;

-- (B) The hero-style catalog was trimmed to: classic, cozy, orbit, spotlight,
--     vanguard. Remap existing sites from deleted styles to the closest kept one.
update public.websites
set hero_style = case hero_style
  when 'vault' then 'vanguard'
  when 'sentinel' then 'orbit'
  when 'liquid' then 'spotlight'
  when 'convix' then 'classic'
  when 'creator' then 'vanguard'
  when 'mainframe' then 'orbit'
  else hero_style
end
where hero_style in ('vault', 'sentinel', 'liquid', 'convix', 'creator', 'mainframe');
