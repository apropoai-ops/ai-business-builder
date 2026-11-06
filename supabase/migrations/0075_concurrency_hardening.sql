-- 0075: concurrency hardening (2026-07-20 platform-wide bug hunt)
-- (A) Rental double-booking: DB-level exclusion constraint so two concurrent
--     checkouts can never hold overlapping non-cancelled bookings on one unit.
create extension if not exists btree_gist;

alter table public.rental_bookings
  drop constraint if exists rental_bookings_no_overlap;
alter table public.rental_bookings
  add constraint rental_bookings_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in, check_out) with &&
  ) where (status <> 'cancelled');

-- (B) Loyalty points: atomic upsert-increment (replaces read-then-write which
--     allowed double-earn/double-spend under concurrent orders).
create or replace function public.increment_loyalty_points(
  p_business_id uuid,
  p_customer_user_id uuid,
  p_delta int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int;
begin
  insert into public.loyalty_points (business_id, customer_user_id, points)
  values (p_business_id, p_customer_user_id, greatest(0, p_delta))
  on conflict (business_id, customer_user_id)
  do update set
    points = greatest(0, public.loyalty_points.points + p_delta),
    updated_at = now()
  returning points into v_points;
  return v_points;
end;
$$;

-- (C) Coupons: atomic guarded use-count adjustment. Positive delta re-checks
--     max_uses inside the UPDATE so concurrent redemptions can't exceed it;
--     negative delta floors at 0. Returns the new used_count, or NULL when a
--     guarded increment was refused (coupon just exhausted).
create or replace function public.adjust_coupon_use(
  p_coupon_id uuid,
  p_delta int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.coupons
  set used_count = greatest(0, used_count + p_delta)
  where id = p_coupon_id
    and (p_delta <= 0 or max_uses is null or used_count < max_uses)
  returning used_count into v_count;
  return v_count; -- null when no row matched (unknown id OR limit reached)
end;
$$;

-- Service-role-only helpers — keep them out of the public RPC surface.
revoke execute on function public.increment_loyalty_points(uuid, uuid, int) from anon, authenticated;
revoke execute on function public.adjust_coupon_use(uuid, int) from anon, authenticated;
