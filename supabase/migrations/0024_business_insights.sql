-- 0024 business insights (Phase 4 — AI Insights Engine)
-- One latest insights doc per business (upserted), generated on demand from the
-- business score + metrics. Owner-only RLS.
create table if not exists public.business_insights (
  business_id   uuid primary key references public.businesses(id) on delete cascade,
  overall_score int,
  content       jsonb not null,
  generated_at  timestamptz not null default now()
);
alter table public.business_insights enable row level security;
create policy "business_insights_owner" on public.business_insights
  for all using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
