-- Per-business WhatsApp App Secret.
--
-- The webhook verified X-Hub-Signature-256 against a single WHATSAPP_APP_SECRET
-- env var. That only works if every customer's messages come from OUR Meta app.
-- In practice each customer creates their own app (that is how they get a Phone
-- Number ID and a token at all), signs with THEIR app secret, and every inbound
-- message failed the HMAC and was rejected 401 — silently, with the agent simply
-- looking dead. The connection form now collects the customer's own app secret
-- and the webhook verifies against it, falling back to the env var.
alter table public.whatsapp_config
  add column if not exists app_secret text;

comment on column public.whatsapp_config.app_secret is
  'Meta app secret for this business''s own app, used to verify X-Hub-Signature-256 on inbound webhooks. Falls back to WHATSAPP_APP_SECRET when null.';
