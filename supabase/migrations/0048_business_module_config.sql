-- Per-business storefront module config (the "בורר מודולים" picker).
alter table businesses
  add column if not exists module_config jsonb not null default '{}'::jsonb;

comment on column businesses.module_config is
  'Per-module storefront config map: { [moduleKey]: { enabled: bool, sort: int } }. Missing keys default to enabled+canonical order. Controls the universal opt-in modules on /sections.';
