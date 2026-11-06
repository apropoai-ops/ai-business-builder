-- WhatsApp conversations that are waiting on a human.
--
-- The agent answers the customer, and then the thread just sits in an inbox
-- nobody opens. These three columns turn that into a queue the owner can be
-- notified about and work through: `needs_reply` is the flag, `needs_reply_since`
-- is what "waiting 3 hours" is measured from, and `handled_at` records that a
-- human closed it. The notification fires on the false -> true transition only,
-- so a twenty-message conversation is one alert, not twenty.
alter table public.whatsapp_conversations
  add column if not exists needs_reply boolean not null default false,
  add column if not exists needs_reply_since timestamptz,
  add column if not exists handled_at timestamptz;

-- The inbox badge counts open items per business on every dashboard load.
create index if not exists whatsapp_conversations_needs_reply_idx
  on public.whatsapp_conversations (business_id)
  where needs_reply;
