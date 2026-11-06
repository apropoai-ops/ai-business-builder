-- ============================================================================
--  Migration 0070 — Private "business-files" storage bucket
-- ============================================================================
-- Backs digital-download deliverables (lib/actions/downloads.ts) and any other
-- owner-uploaded private file. Unlike the public 'site-assets' bucket (0011),
-- this bucket is PRIVATE — files are only reachable via a short-lived signed
-- URL (see app/api/downloads/[id]/route.ts), never a public CDN URL.
--
-- Objects are stored under a "<business_id>/..." key prefix; the owner-only
-- RLS policies below extract that prefix with storage.foldername() and check
-- it against is_business_owner() (defined in 0001_foundation.sql).

insert into storage.buckets (id, name, public)
values ('business-files', 'business-files', false)
on conflict (id) do nothing;

drop policy if exists "business_files_owner_select" on storage.objects;
create policy "business_files_owner_select" on storage.objects
  for select
  using (
    bucket_id = 'business-files'
    and public.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "business_files_owner_insert" on storage.objects;
create policy "business_files_owner_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'business-files'
    and public.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "business_files_owner_update" on storage.objects;
create policy "business_files_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'business-files'
    and public.is_business_owner((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'business-files'
    and public.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "business_files_owner_delete" on storage.objects;
create policy "business_files_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'business-files'
    and public.is_business_owner((storage.foldername(name))[1]::uuid)
  );

-- Downloads: internal storage path for uploaded (as opposed to externally
-- linked) files. NULL when the item still uses an external file_url.
alter table public.downloads
  add column if not exists storage_path text;

-- Uploaded items live in storage (storage_path) and have no external URL.
alter table public.downloads
  alter column file_url drop not null;
