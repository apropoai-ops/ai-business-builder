-- 0057: CRM upgrade — unified activity timeline (notes + auto-logged events),
-- "next action" discipline on leads (Pipedrive-style), and task↔entity links.

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  customer_id uuid references public.crm_customers(id) on delete cascade,
  kind text not null check (kind in ('note','status','task','system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.crm_activities enable row level security;

create policy "crm_activities_owner_all" on public.crm_activities
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index crm_activities_lead_idx
  on public.crm_activities (business_id, lead_id, created_at desc)
  where lead_id is not null;
create index crm_activities_customer_idx
  on public.crm_activities (business_id, customer_id, created_at desc)
  where customer_id is not null;

-- Every lead should have a next step (and we track the last touch).
alter table public.crm_leads
  add column if not exists next_follow_up_at date,
  add column if not exists last_contacted_at timestamptz;

-- Tasks can belong to a lead or a customer (shown on their timeline).
alter table public.crm_tasks
  add column if not exists lead_id uuid references public.crm_leads(id) on delete set null,
  add column if not exists customer_id uuid references public.crm_customers(id) on delete set null;
