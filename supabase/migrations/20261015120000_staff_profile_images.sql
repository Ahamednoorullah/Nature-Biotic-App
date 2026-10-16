/*
# Staff profile images

Allow active signed-in users to store staff photos in the private
company-assets bucket under staff/<store id>/<staff id>/<file>.
Existing logo, signature, and farmer policies are unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'company_assets_staff_insert'
  ) THEN
    CREATE POLICY company_assets_staff_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'staff'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'company_assets_staff_update'
  ) THEN
    CREATE POLICY company_assets_staff_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'staff'
      )
      WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'staff'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'company_assets_staff_delete'
  ) THEN
    CREATE POLICY company_assets_staff_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'staff'
      );
  END IF;
END $$;

create or replace function public.staff_login_states()
returns table (staff_id uuid, account_status text, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.staff_id,
    case
      when p.status = 'disabled' then 'disabled'
      when coalesce(u.encrypted_password, '') = '' then 'invitation_pending'
      else 'active'
    end,
    p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'fro'
    and p.staff_id is not null
    and public.is_company_admin();
$$;

revoke all on function public.staff_login_states() from public;
grant execute on function public.staff_login_states() to authenticated;
