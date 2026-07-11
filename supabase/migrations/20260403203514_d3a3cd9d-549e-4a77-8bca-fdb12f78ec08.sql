
-- Fix 1: Remove stock_movements DELETE policies and make deletions impossible
DROP POLICY IF EXISTS "Stock managers can delete stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins can delete stock movements" ON public.stock_movements;

CREATE POLICY "No deletions on stock movements"
ON public.stock_movements FOR DELETE
USING (false);

-- Fix 2: Tighten chat-media SELECT to approved users only
DROP POLICY IF EXISTS "Authenticated users can view chat media" ON storage.objects;

CREATE POLICY "Approved users can view chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND is_app_user(auth.uid())
);
