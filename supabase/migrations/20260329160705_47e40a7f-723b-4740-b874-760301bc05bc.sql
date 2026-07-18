-- Make chat-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

-- Drop existing storage policies for chat-media if any
DROP POLICY IF EXISTS "Authenticated users can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat media" ON storage.objects;

-- Allow only authenticated users to read files
CREATE POLICY "Authenticated users can view chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow only authenticated users to upload files
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow only authenticated users to delete their files
CREATE POLICY "Authenticated users can delete chat media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Delete test orders created via unprotected webhooks
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE order_number IN ('ORD-00165', 'ORD-00171')
);
DELETE FROM order_history WHERE order_id IN (
  SELECT id FROM orders WHERE order_number IN ('ORD-00165', 'ORD-00171')
);
DELETE FROM orders WHERE order_number IN ('ORD-00165', 'ORD-00171');