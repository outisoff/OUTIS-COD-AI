
-- Fix 1: Tighten chat-media INSERT policy to require is_app_user
DROP POLICY IF EXISTS "Authenticated users can upload own chat media" ON storage.objects;
CREATE POLICY "Approved users can upload own chat media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media'
  AND is_app_user(auth.uid())
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Fix 2: Tighten chat-media DELETE policy to require is_app_user
DROP POLICY IF EXISTS "Authenticated users can delete own chat media" ON storage.objects;
CREATE POLICY "Approved users can delete own chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media'
  AND is_app_user(auth.uid())
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Fix 3: Simplify profile UPDATE policy to explicitly block is_approved changes for non-admins
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
  CASE
    WHEN has_role(auth.uid(), 'admin') THEN true
    WHEN id = auth.uid() THEN is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN has_role(auth.uid(), 'admin') THEN true
    WHEN id = auth.uid() THEN (
      is_approved = (SELECT p.is_approved FROM profiles p WHERE p.id = auth.uid())
      AND full_name IS NOT NULL
    )
    ELSE false
  END
);
