-- 0027 mark a business as existing/established (wizard step 3).
-- Drives a growth/optimization-focused AI build; customer details are folded
-- into the description that feeds all AI agents.
alter table public.businesses add column if not exists is_existing boolean not null default false;
