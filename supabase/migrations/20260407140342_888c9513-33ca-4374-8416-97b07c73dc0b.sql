
-- 1. Add UPDATE policy on chat-media storage bucket to restrict file replacement to owner
CREATE POLICY "Only owner can update chat media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Add DELETE policy on auto_confirmation_logs for admins
CREATE POLICY "Admins can delete auto confirmation logs"
ON public.auto_confirmation_logs FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
