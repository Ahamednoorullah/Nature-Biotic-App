/*
# Nature Biotic — Storage Policies for Farmer Profile Images

Allow authenticated active users (company admins, store admins, and FRO staff)
to upload, update, and delete farmer profile images within the 'farmers' folder
of the 'company-assets' storage bucket.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'company_assets_farmers_insert'
  ) THEN
    CREATE POLICY company_assets_farmers_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'farmers'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'company_assets_farmers_update'
  ) THEN
    CREATE POLICY company_assets_farmers_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'farmers'
      )
      WITH CHECK (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'farmers'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'company_assets_farmers_delete'
  ) THEN
    CREATE POLICY company_assets_farmers_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'company-assets'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = 'farmers'
      );
  END IF;
END $$;
