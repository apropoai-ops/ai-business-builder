-- 0026 cover the project_tasks -> businesses foreign key (advisor: unindexed FK).
create index if not exists idx_project_tasks_business on public.project_tasks (business_id);
