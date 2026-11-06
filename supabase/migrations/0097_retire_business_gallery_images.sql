-- 0097 — businesses.gallery_images (0093) was written by the design-tab
-- gallery widget but never read anywhere except that same widget — not the
-- sections-page gallery, not the public site. gallery_items (0096) already
-- does this job and IS rendered publicly (components/public/gallery-section.tsx).
-- Move any stranded photos across, then drop the dead column.

insert into public.gallery_items (business_id, image_url, sort)
select
  b.id,
  img,
  coalesce((select max(sort) + 1 from public.gallery_items gi where gi.business_id = b.id), 0)
    + row_number() over (partition by b.id order by ordinality) - 1
from public.businesses b
cross join lateral unnest(b.gallery_images) with ordinality as t(img, ordinality)
where coalesce(array_length(b.gallery_images, 1), 0) > 0;

alter table public.businesses drop column gallery_images;
