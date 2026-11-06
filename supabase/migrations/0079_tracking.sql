-- 0079: conversion tracking IDs for the public site.
--
-- One jsonb blob instead of four columns: the set of ad platforms an owner
-- wants to measure changes far more often than the schema should. Shape (all
-- keys optional, only validated IDs are ever written — see lib/tracking.ts):
--   { "meta_pixel_id": "1234567890",
--     "ga4_id": "G-XXXXXXX",
--     "tiktok_pixel_id": "CXXXXXXXXXXXXXXXXXXX",
--     "gtm_id": "GTM-XXXXXX" }
--
-- Lives on `websites` (not `businesses`) because it is a property of the
-- published site — it travels with the slug, and the public renderer already
-- reads that row.
alter table public.websites
  add column if not exists tracking jsonb not null default '{}'::jsonb;
