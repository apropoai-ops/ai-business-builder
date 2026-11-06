-- ============================================================================
--  Migration 0008 — WhatsApp Business Cloud API (live connection)
--  Connection credentials on whatsapp_config + conversation/message storage.
-- ============================================================================

-- ── Connection fields on whatsapp_config ────────────────────────────────────
alter table public.whatsapp_config
  add column if not exists phone_number_id text,
  add column if not exists access_token    text,
  add column if not exists display_phone    text,
  add column if not exists connected        boolean not null default false;

-- Route inbound webhooks to the owning business by phone_number_id.
create index if not exists idx_whatsapp_config_phone_number_id
  on public.whatsapp_config(phone_number_id);

-- ============================================================================
--  whatsapp_conversations — one thread per (business, contact phone)
-- ============================================================================
create table if not exists public.whatsapp_conversations (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  contact_phone   text not null,
  contact_name    text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, contact_phone)
);
create index if not exists idx_wa_conversations_business
  on public.whatsapp_conversations(business_id, last_message_at desc);

drop trigger if exists trg_wa_conversations_updated_at on public.whatsapp_conversations;
create trigger trg_wa_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();

-- ============================================================================
--  whatsapp_messages — inbound/outbound message log
-- ============================================================================
create table if not exists public.whatsapp_messages (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction       text not null check (direction in ('inbound', 'outbound')),
  content         text not null,
  wa_message_id   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_wa_messages_conversation
  on public.whatsapp_messages(conversation_id, created_at);

-- ============================================================================
--  Row Level Security — owner read access (writes happen via service role
--  in the webhook, which bypasses RLS).
-- ============================================================================
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages      enable row level security;

drop policy if exists "wa_conversations_owner" on public.whatsapp_conversations;
create policy "wa_conversations_owner" on public.whatsapp_conversations
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists "wa_messages_owner" on public.whatsapp_messages;
create policy "wa_messages_owner" on public.whatsapp_messages
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
