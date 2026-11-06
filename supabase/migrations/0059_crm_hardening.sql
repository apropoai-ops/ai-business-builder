-- 0059: CRM hardening — lead→customer conversion tracking (without clobbering
-- lead notes), deal↔lead/customer linkage, lost-reason capture, and indexes
-- to support paged lists + search at scale.

alter table public.crm_leads
  add column if not exists converted_customer_id uuid references public.crm_customers(id) on delete set null,
  add column if not exists lost_reason text;

alter table public.crm_deals
  add column if not exists lead_id uuid references public.crm_leads(id) on delete set null,
  add column if not exists customer_id uuid references public.crm_customers(id) on delete set null,
  add column if not exists expected_close_date date;

-- Paged list scans (business_id, created_at desc is the standard listing order).
create index if not exists crm_leads_business_created_idx
  on public.crm_leads (business_id, created_at desc);
create index if not exists crm_customers_business_created_idx
  on public.crm_customers (business_id, created_at desc);
create index if not exists crm_deals_business_created_idx
  on public.crm_deals (business_id, created_at desc);
create index if not exists crm_tasks_business_created_idx
  on public.crm_tasks (business_id, created_at desc);

-- Conversion / linkage lookups.
create index if not exists crm_leads_converted_customer_idx
  on public.crm_leads (converted_customer_id)
  where converted_customer_id is not null;
create index if not exists crm_deals_lead_idx
  on public.crm_deals (lead_id)
  where lead_id is not null;
create index if not exists crm_deals_customer_idx
  on public.crm_deals (customer_id)
  where customer_id is not null;

-- Duplicate-phone check on lead create + name/phone/email search.
create index if not exists crm_leads_business_phone_idx
  on public.crm_leads (business_id, phone)
  where phone is not null;
create index if not exists crm_leads_name_idx
  on public.crm_leads (business_id, lower(name));
create index if not exists crm_customers_name_idx
  on public.crm_customers (business_id, lower(name));
create index if not exists crm_deals_title_idx
  on public.crm_deals (business_id, lower(title));
