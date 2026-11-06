-- 0021 quotes (הצעות מחיר)
-- Owner builds a quote with line items, shares a public token link; the customer
-- views it and accepts/declines. Owner gets full RLS; public view/accept/decline
-- go through service-role server actions scoped by public_token.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  title text not null,
  customer_name text not null,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  notes text,
  discount numeric not null default 0 check (discount >= 0),
  tax_rate numeric not null default 18 check (tax_rate >= 0 and tax_rate <= 100),
  valid_until date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_quotes_business on public.quotes (business_id, status, created_at);
alter table public.quotes enable row level security;
create policy "quotes_owner_all" on public.quotes
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
