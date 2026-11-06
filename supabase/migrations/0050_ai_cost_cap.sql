-- ============================================================================
--  Migration 0050 — Per-business monthly AI cost cap.
--  Adds an estimated-USD spend counter to usage_counters and an atomic
--  service-role RPC to accumulate it. The cap value itself lives per-plan in
--  lib/plans.ts (monthlyCostCapUsd); enforcement is in lib/quota.ts.
-- ============================================================================

alter table public.usage_counters
  add column if not exists ai_cost_usd numeric not null default 0;

create or replace function public.add_ai_cost(
  p_business_id uuid,
  p_period text,
  p_amount numeric
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_total numeric;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'invalid cost amount %', p_amount;
  end if;

  insert into usage_counters (business_id, period)
  values (p_business_id, p_period)
  on conflict (business_id, period) do nothing;

  update usage_counters set ai_cost_usd = ai_cost_usd + p_amount
    where business_id = p_business_id and period = p_period
    returning ai_cost_usd into new_total;

  return new_total;
end;
$$;

-- Service-role only — like bump_usage, all writes go through server code.
revoke execute on function public.add_ai_cost(uuid, text, numeric) from anon, authenticated, public;
