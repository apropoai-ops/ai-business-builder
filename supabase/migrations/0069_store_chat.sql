-- 0069: Storefront AI chat widget — a public-site chat bubble that answers
-- visitor questions using the same AI agent style as the WhatsApp assistant.
-- The API route (app/api/store-chat) talks to these tables via the
-- service-role client (visitors are anonymous, same pattern as the WhatsApp
-- webhook) — the RLS policies below only grant the business owner read
-- access, for a future chat inbox.

alter table public.businesses
  add column if not exists store_chat_enabled boolean not null default false;

create table if not exists public.store_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  visitor_key text not null,
  created_at timestamptz not null default now()
);

alter table public.store_chat_sessions enable row level security;

drop policy if exists "store_chat_sessions_owner_select" on public.store_chat_sessions;
create policy "store_chat_sessions_owner_select" on public.store_chat_sessions
  for select
  using (public.is_business_owner(business_id));

create index if not exists store_chat_sessions_business_idx
  on public.store_chat_sessions (business_id, created_at desc);

create table if not exists public.store_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.store_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.store_chat_messages enable row level security;

-- No business_id column on messages (kept lean per spec), so ownership is
-- resolved through the parent session — mirrors other owner-scoped joins in
-- this codebase (e.g. crm_activities → lead/customer).
drop policy if exists "store_chat_messages_owner_select" on public.store_chat_messages;
create policy "store_chat_messages_owner_select" on public.store_chat_messages
  for select
  using (
    exists (
      select 1
      from public.store_chat_sessions s
      where s.id = store_chat_messages.session_id
        and public.is_business_owner(s.business_id)
    )
  );

create index if not exists store_chat_messages_session_idx
  on public.store_chat_messages (session_id, created_at);
