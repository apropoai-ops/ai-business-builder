-- 0093 — general business photo gallery.
--
-- Products (0028, `images jsonb`) and rental units (0087, `images text[]`)
-- both solved "a gallery of photos for an entity" the same way: a plain array
-- column on the owning row, not a join table. This copies that shape for the
-- business itself, for photos taken before any product/unit exists yet (the
-- wizard's new photo step, and the design tab for an existing business).
--
-- No new RLS needed: this is a column on `businesses`, already scoped to the
-- owning user by the existing businesses RLS policies.
alter table public.businesses
  add column if not exists gallery_images text[] not null default '{}';
