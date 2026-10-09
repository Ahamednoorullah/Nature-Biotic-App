/*
# Nature Biotic ERP/CRM — 06 Storage: company-assets bucket

Holds the company logo and the authorized signature used on company documents
(Company Invoice, Credit Note / Debit Note, Receipt, Refund PDFs).

- Private bucket (not public); any active signed-in user can read, because store
  users also open company PDFs.
- Only company admins can upload, replace or delete.
- Paths: logo/<file>, signature/<file>. The chosen paths are saved in
  company_profile.logo_path and company_profile.signature_path.
- Images only (PNG / JPEG / WEBP), max 2 MB.
*/

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-assets', 'company-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy company_assets_read on storage.objects
  for select to authenticated
  using (bucket_id = 'company-assets' and public.is_active_user());

create policy company_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and public.is_company_admin()
    and (storage.foldername(name))[1] in ('logo', 'signature')
  );

create policy company_assets_update on storage.objects
  for update to authenticated
  using (bucket_id = 'company-assets' and public.is_company_admin())
  with check (
    bucket_id = 'company-assets'
    and public.is_company_admin()
    and (storage.foldername(name))[1] in ('logo', 'signature')
  );

create policy company_assets_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'company-assets' and public.is_company_admin());
