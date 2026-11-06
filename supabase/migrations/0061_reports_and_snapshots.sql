-- ============================================================================
--  Migration 0061 — Reports dashboard + Business Score history.
--  - site_visits gains a `path` column (top-pages breakdown on /reports).
--  - business_score_snapshots: periodic history of the deterministic score,
--    owner-readable and owner-writable (written by the RLS-scoped server
--    code in lib/services/business-score.service.ts on score-page load).
--  - get_business_report(): SECURITY DEFINER RPC returning a bucketed
--    (day/week/month) time series of paid-order revenue, bookings, new
--    leads and site visits for a business, powering /reports.
-- ============================================================================

alter table public.site_visits add column if not exists path text;
create index if not exists idx_site_visits_business_path on public.site_visits (business_id, path);

-- ── business_score_snapshots ────────────────────────────────────────────────
create table if not exists public.business_score_snapshots (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  total       int not null,
  dimensions  jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_score_snapshots_business_time
  on public.business_score_snapshots (business_id, created_at desc);
alter table public.business_score_snapshots enable row level security;

drop policy if exists "score_snapshots_owner_all" on public.business_score_snapshots;
create policy "score_snapshots_owner_all" on public.business_score_snapshots
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ── get_business_report: bucketed time series for the reports dashboard ────
-- SECURITY DEFINER so the four source tables can be aggregated in one round
-- trip; guarded by an explicit is_business_owner() check (raises for
-- non-owners), so it is safe to expose to `authenticated` via supabase.rpc.
create or replace function public.get_business_report(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day'
)
returns table (
  bucket_start   timestamptz,
  revenue        numeric,
  orders_count   bigint,
  bookings_count bigint,
  leads_count    bigint,
  visits_count   bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'not authorized';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'invalid bucket: %', p_bucket;
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid range';
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(p_bucket, p_from at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem',
      date_trunc(p_bucket, p_to at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem',
      ('1 ' || p_bucket)::interval
    ) as b
  ),
  ord as (
    select date_trunc(p_bucket, o.paid_at at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem' as b,
           sum(coalesce(o.total, 0)) as revenue,
           count(*) as cnt
    from public.orders o
    where o.business_id = p_business_id
      and o.payment_status = 'paid'
      and o.paid_at between p_from and p_to
    group by 1
  ),
  bk as (
    select date_trunc(p_bucket, b.starts_at at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem' as b, count(*) as cnt
    from public.bookings b
    where b.business_id = p_business_id
      and b.status not in ('cancelled', 'blocked')
      and b.starts_at between p_from and p_to
    group by 1
  ),
  ld as (
    select date_trunc(p_bucket, l.created_at at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem' as b, count(*) as cnt
    from public.crm_leads l
    where l.business_id = p_business_id
      and l.created_at between p_from and p_to
    group by 1
  ),
  vs as (
    select date_trunc(p_bucket, v.created_at at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem' as b, count(*) as cnt
    from public.site_visits v
    where v.business_id = p_business_id
      and v.created_at between p_from and p_to
    group by 1
  )
  select
    buckets.b,
    coalesce(ord.revenue, 0),
    coalesce(ord.cnt, 0),
    coalesce(bk.cnt, 0),
    coalesce(ld.cnt, 0),
    coalesce(vs.cnt, 0)
  from buckets
  left join ord on ord.b = buckets.b
  left join bk on bk.b = buckets.b
  left join ld on ld.b = buckets.b
  left join vs on vs.b = buckets.b
  order by buckets.b;
end;
$$;

revoke all on function public.get_business_report(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_business_report(uuid, timestamptz, timestamptz, text) to authenticated;
