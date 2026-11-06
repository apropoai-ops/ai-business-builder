-- 0025 Operations (Phase 5): project management + AI HR module. Owner-only RLS.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active','done','archived')),
  due_date    date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_projects_business on public.projects(business_id, status, created_at);
alter table public.projects enable row level security;
create policy "projects_owner" on public.projects
  for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title       text not null,
  assignee    text,
  done        boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_project_tasks_project on public.project_tasks(project_id);
alter table public.project_tasks enable row level security;
create policy "project_tasks_owner" on public.project_tasks
  for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create table if not exists public.hr_roles (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title       text not null,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_hr_roles_business on public.hr_roles(business_id, created_at);
alter table public.hr_roles enable row level security;
create policy "hr_roles_owner" on public.hr_roles
  for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
