-- Free-form key/value spec fields per product ("חומר", "משקל", "קראט" —
-- whatever a given product category needs), matching the jsonb pattern
-- already used for colors/engraving/tags rather than adding a rigid column
-- per vertical.
alter table public.products
  add column if not exists attributes jsonb not null default '{}'::jsonb;
