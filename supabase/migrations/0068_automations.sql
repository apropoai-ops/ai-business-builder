-- 0068: automations rules engine — "when X happens, do Y" rules the owner
-- configures per business (new lead / order paid / booking created /
-- abandoned cart -> notify owner / email customer / whatsapp customer /
-- create a CRM task), plus a run log so the owner can see what fired.

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  trigger text not null check (trigger in ('new_lead', 'order_paid', 'booking_created', 'abandoned_cart')),
  conditions jsonb not null default '{}'::jsonb,
  action text not null check (action in ('notify_owner', 'email_customer', 'whatsapp_customer', 'create_task')),
  action_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.automations enable row level security;

create policy "automations_owner_all" on public.automations
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index if not exists automations_business_trigger_idx
  on public.automations (business_id, trigger)
  where enabled = true;

drop trigger if exists trg_automations_updated_at on public.automations;
create trigger trg_automations_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  trigger text not null,
  status text not null check (status in ('ok', 'failed')),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.automation_runs enable row level security;

create policy "automation_runs_owner_all" on public.automation_runs
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index if not exists automation_runs_business_idx
  on public.automation_runs (business_id, created_at desc);
