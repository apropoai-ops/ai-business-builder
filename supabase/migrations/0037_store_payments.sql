-- ============================================================================
--  Migration 0037 — Wave B: store payments (customer → merchant).
--  FREE infrastructure first (manual methods, payment status, tax invoices,
--  refunds). Real card processing (Stripe) is wired later and only goes Live at
--  the paid go-live step. Distinct from the PLATFORM's subscription billing
--  (subscriptions table / app/api/webhooks/stripe) which charges owners for the
--  SaaS — this is shoppers paying the merchant for store orders.
--  Applied via MCP.
-- ============================================================================

-- ── Merchant payment + invoicing settings ──────────────────────────────────
alter table public.businesses
  -- Enabled checkout methods, e.g. ["cod","bank_transfer","bit","card","paypal"].
  add column if not exists payment_methods jsonb not null default '["cod"]'::jsonb,
  -- Bank-transfer instructions shown to the shopper: {bank,branch,account,holder}.
  add column if not exists bank_details jsonb,
  -- Bit: the phone/number the shopper sends the payment to.
  add column if not exists bit_phone text,
  -- PayPal.Me / PayPal checkout link (card link reuses the existing payment_link).
  add column if not exists paypal_link text,
  -- Tax invoices (Israel): merchant tax id (ע.מ/ח.פ) + VAT rate + running number.
  add column if not exists business_tax_id text,
  add column if not exists vat_rate numeric not null default 18,
  add column if not exists next_invoice_number int not null default 1;

-- ── Per-order payment state ─────────────────────────────────────────────────
alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','refunded','partially_refunded','failed')),
  add column if not exists paid_at timestamptz;

-- ── Tax invoices (חשבונית מס) ───────────────────────────────────────────────
create table if not exists public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  invoice_number text not null,
  customer_name text not null,
  customer_tax_id text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  vat_rate numeric not null default 18,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  lines jsonb,                 -- snapshot of invoiced line items
  issued_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);
create index if not exists idx_order_invoices_business on public.order_invoices (business_id, issued_at);
create index if not exists idx_order_invoices_order on public.order_invoices (order_id);
alter table public.order_invoices enable row level security;
drop policy if exists "order_invoices_owner_all" on public.order_invoices;
create policy "order_invoices_owner_all" on public.order_invoices
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
-- Customers can read invoices for their OWN orders (for the personal area).
drop policy if exists "order_invoices_customer_select" on public.order_invoices;
create policy "order_invoices_customer_select" on public.order_invoices
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_invoices.order_id and o.customer_user_id = auth.uid()
  ));

-- ── Refunds / credit notes (זיכויים) ────────────────────────────────────────
create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric not null check (amount > 0),
  reason text,
  status text not null default 'done' check (status in ('pending','done','failed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_order_refunds_business on public.order_refunds (business_id, created_at);
create index if not exists idx_order_refunds_order on public.order_refunds (order_id);
alter table public.order_refunds enable row level security;
drop policy if exists "order_refunds_owner_all" on public.order_refunds;
create policy "order_refunds_owner_all" on public.order_refunds
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
drop policy if exists "order_refunds_customer_select" on public.order_refunds;
create policy "order_refunds_customer_select" on public.order_refunds
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_refunds.order_id and o.customer_user_id = auth.uid()
  ));
