-- 0064: external invoices — tax documents (חשבונית מס/קבלה) issued at Israeli
-- invoicing providers (Green Invoice / iCount) for paid store orders. One row
-- per issued document; failed attempts are logged too (status='failed' +
-- error) so the owner can see why a document wasn't produced.

create table if not exists public.external_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  provider text not null,
  doc_type text not null,
  external_id text,
  number text,
  url text,
  status text not null default 'issued',
  error text,
  created_at timestamptz not null default now()
);

alter table public.external_invoices enable row level security;

create policy "external_invoices_owner_all" on public.external_invoices
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create index if not exists external_invoices_business_idx
  on public.external_invoices (business_id, created_at desc);

create index if not exists external_invoices_order_idx
  on public.external_invoices (order_id)
  where order_id is not null;
