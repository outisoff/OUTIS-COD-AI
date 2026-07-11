
-- Create storage bucket for chat media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

-- Allow public access to read files (needed for WASender to fetch the URL)
CREATE POLICY "Public can view chat media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete chat media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);
