
-- Fix 1: Remove overly permissive RLS policies on auto_confirmation_logs
DROP POLICY IF EXISTS "Service role can manage auto confirmation logs" ON public.auto_confirmation_logs;
DROP POLICY IF EXISTS "Allow insert from service role" ON public.auto_confirmation_logs;

-- Fix 2: Fix profiles update policy to prevent users from modifying is_approved
-- Drop existing policy
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

-- Create new policy: users can update their own non-sensitive fields regardless of approval status
-- but cannot modify is_approved. Admins can update anything.
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
  (id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN id = auth.uid() THEN
      -- Non-admin users cannot change is_approved
      is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM public.profiles p WHERE p.id = auth.uid())
    ELSE false
  END
);
