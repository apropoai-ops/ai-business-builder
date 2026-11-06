-- 0091: loyalty redemption race (2026-08-12 bug hunt)
-- Redeeming points was a read-then-write: createPublicCartOrder read the
-- balance, derived the discount, persisted it as the order total, and only
-- debited afterwards via increment_loyalty_points — whose greatest(0, ...)
-- clamp silently absorbed the second debit. Two carts submitted in the same
-- second both applied the full discount and the merchant ate the difference.
--
-- Guarded debit, mirroring adjust_coupon_use (0075 C): the UPDATE only matches
-- while the balance still covers the whole redemption, so exactly one of two
-- concurrent carts can spend it. Returns the new balance, or NULL when it
-- refused (no balance row, or not enough points left) — the caller then drops
-- the loyalty discount. Intended for DEBITS (negative p_delta); credits keep
-- using increment_loyalty_points, which upserts a missing balance row.
create or replace function public.adjust_loyalty_points_guarded(
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
  update public.loyalty_points
  set points = points + p_delta,
      updated_at = now()
  where business_id = p_business_id
    and customer_user_id = p_customer_user_id
    and points >= -p_delta
  returning points into v_points;
  return v_points; -- null when no row matched (no balance row OR too few points)
end;
$$;

-- Service-role-only helper — Postgres grants EXECUTE to PUBLIC by default, so
-- revoke from PUBLIC as well as the API roles (the 0076 lesson).
revoke execute on function public.adjust_loyalty_points_guarded(uuid, uuid, int) from public, anon, authenticated;
