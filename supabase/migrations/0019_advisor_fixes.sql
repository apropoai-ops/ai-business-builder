-- 0019 advisor fixes
-- Security: bump_usage is service-role only. The 0014 revoke targeted anon/authenticated
-- but EXECUTE is granted to PUBLIC by default (which those roles inherit), so the function
-- was still callable by anon/authenticated. Revoke from PUBLIC explicitly. Service role
-- bypasses grants, so quota bumping (lib/quota.ts via createServiceRoleClient) is unaffected.
revoke execute on function public.bump_usage(uuid, text, text) from public;

-- Performance: cover the orders -> products foreign key with an index.
create index if not exists idx_orders_product_id on public.orders (product_id);
