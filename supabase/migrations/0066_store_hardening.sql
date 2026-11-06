-- ============================================================================
--  Migration 0066 — Store hardening: atomic stock ops, coupon deferred
--  redemption + release, shipped status/tracking, atomic invoice numbering.
--  Applied via MCP.
-- ============================================================================

-- ── Atomic variant-stock decrement ──────────────────────────────────────────
-- Single atomic UPDATE guards against the race between concurrent orders
-- reading a stale stock_qty. Returns true iff the row existed and had enough
-- stock (and was decremented). p_allow_negative lets pre-order lines through
-- unconditionally (pre-order stock is allowed to go negative — the owner
-- reconciles on restock), matching the app's existing pre-order behavior.
create or replace function public.decrement_variant_stock(
  p_variant_id uuid,
  p_qty int,
  p_allow_negative boolean default false
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_qty is null or p_qty <= 0 then
    return false;
  end if;

  if p_allow_negative then
    update public.product_variants
    set stock_qty = stock_qty - p_qty
    where id = p_variant_id
    returning true into v_ok;
  else
    update public.product_variants
    set stock_qty = stock_qty - p_qty
    where id = p_variant_id and stock_qty >= p_qty
    returning true into v_ok;
  end if;

  return coalesce(v_ok, false);
end;
$$;

-- Matching restock (order cancellation / refund). Always succeeds if the
-- variant row exists — restocking never needs a floor check.
create or replace function public.restock_variant_stock(
  p_variant_id uuid,
  p_qty int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_qty is null or p_qty <= 0 then
    return false;
  end if;

  update public.product_variants
  set stock_qty = stock_qty + p_qty
  where id = p_variant_id
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Service-role only — both are invoked from server-side checkout/fulfillment
-- code using the service-role client, never directly by a shopper/owner.
revoke execute on function public.decrement_variant_stock(uuid, int, boolean) from anon, authenticated, public;
revoke execute on function public.restock_variant_stock(uuid, int) from anon, authenticated, public;

-- ── Orders: coupon/referral deferred-redemption tracking + shipped status ──
alter table public.orders
  -- Coupon code applied at checkout — redeemed (used_count bump) immediately
  -- for instant/free payment methods, deferred to finalizePaidStoreOrder for
  -- card orders so an abandoned/failed card checkout never consumes a use.
  add column if not exists coupon_code text,
  -- Referral code + points spent captured at checkout time; for card orders
  -- these are applied on payment confirmation (see finalizePaidStoreOrder).
  add column if not exists referral_code text,
  add column if not exists points_used int not null default 0,
  -- Shipped-status timestamp. tracking_number already exists (0039) — kept
  -- idempotent here in case this migration runs against a fresh DB.
  add column if not exists shipped_at timestamptz,
  add column if not exists tracking_number text;

-- Extend the status check constraint to allow the new 'shipped' stage
-- (new -> confirmed -> shipped -> done, with cancelled reachable from new/confirmed).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new','confirmed','shipped','done','cancelled'));

-- ── Atomic sequential invoice numbering ─────────────────────────────────────
-- Replaces the read-then-write next_invoice_number bump in
-- store-payments.service.ts with a single UPDATE...RETURNING, avoiding the
-- race between two concurrent "issue invoice" calls reusing the same number.
-- Callable by the business owner directly (RLS-equivalent ownership check
-- inline, since store-payments.service.ts runs on the owner's session client).
create or replace function public.next_invoice_number(p_business_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number int;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'not authorized';
  end if;

  update public.businesses
  set next_invoice_number = next_invoice_number + 1
  where id = p_business_id
  returning next_invoice_number - 1 into v_number;

  return v_number;
end;
$$;

revoke execute on function public.next_invoice_number(uuid) from anon, public;
grant execute on function public.next_invoice_number(uuid) to authenticated;
