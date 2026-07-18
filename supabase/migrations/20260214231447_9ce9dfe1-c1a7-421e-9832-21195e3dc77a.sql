
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role can manage auto confirmation logs" ON public.auto_confirmation_logs;
DROP POLICY IF EXISTS "Allow insert from service role" ON public.auto_confirmation_logs;

-- Add proper update policy for admins
CREATE POLICY "Admins can update auto confirmation logs"
  ON public.auto_confirmation_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
