-- 0078: landing-page content + owner-controlled landing knobs (site_mode='landing').
--
-- page_landing holds the AI-written copy for the eleven fixed sections
-- (hero → בעיה → פתרון → יתרונות → למי מתאים → תמונות → סרטון → ביקורות →
--  FAQ → CTA → טופס). It is a separate column from page_home on purpose: a
-- landing page and a multi-page site are different content shapes, and keeping
-- them apart means switching modes never destroys the other one's content.
alter table public.websites
  add column if not exists page_landing jsonb;

-- Owner knobs the AI does not write: countdown timer, video URL, gallery.
-- Shape: { countdownEnabled, countdownEndsAt, countdownLabel, videoUrl, galleryUrls[] }
alter table public.websites
  add column if not exists landing_settings jsonb not null default '{}'::jsonb;
