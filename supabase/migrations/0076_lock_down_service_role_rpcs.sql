-- 0076: the 0075 RPCs are service-role-only. Postgres grants EXECUTE to PUBLIC
-- by default, so `revoke ... from anon, authenticated` alone (in 0075) left them
-- callable via the public REST API. Revoke from PUBLIC + the API roles.
revoke execute on function public.increment_loyalty_points(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.adjust_coupon_use(uuid, int) from public, anon, authenticated;
