-- Hero styles reduced to three: orbit, spotlight, vanguard.
-- "classic" and "cozy" were removed from the product; the renderer no longer
-- has a branch for them, so every stored value must be remapped or those sites
-- fall through to the default and silently change look without being counted.
--
-- websites.hero_style is free text (no CHECK constraint), so this is a plain
-- UPDATE. Mapping rationale:
--   classic  -> spotlight  (full-bleed hero image + centred headline is the
--                           closest surviving composition)
--   cozy     -> spotlight  (warm, photo-led; nothing else is close)
-- Anything already on one of the three is untouched.

update public.websites
set hero_style = 'spotlight'
where hero_style in ('classic', 'cozy');

-- Sites that never had a style set also render through the fallback, which is
-- now spotlight — write it down so the picker shows a selected card instead of
-- an empty state.
update public.websites
set hero_style = 'spotlight'
where hero_style is null or btrim(hero_style) = '';
