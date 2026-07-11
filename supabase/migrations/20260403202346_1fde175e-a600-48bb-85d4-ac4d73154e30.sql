-- 1. Drop the public (unauthenticated) SELECT policy on chat-media
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;

-- 2. Drop old INSERT/DELETE policies that lack ownership checks
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat media" ON storage.objects;

-- 3. Recreate INSERT policy with path-based ownership (files stored under user's uid folder)
CREATE POLICY "Authenticated users can upload own chat media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Recreate DELETE policy with path-based ownership
CREATE POLICY "Authenticated users can delete own chat media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Keep existing authenticated SELECT policy (already exists: "Authenticated users can view chat media")