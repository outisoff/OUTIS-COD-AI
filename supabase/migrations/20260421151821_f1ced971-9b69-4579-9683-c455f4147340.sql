-- 1. Rename meta_pages.page_access_token to page_access_token_encrypted for consistency
ALTER TABLE public.meta_pages 
  RENAME COLUMN page_access_token TO page_access_token_encrypted;

-- 2. Enable RLS on realtime.messages and restrict subscriptions to approved app users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "App users can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_app_user(auth.uid()));

-- 3. Restrict profiles update policy to authenticated role only
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN (id = auth.uid()) THEN public.is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN (id = auth.uid()) THEN (
      (is_approved = (SELECT p.is_approved FROM public.profiles p WHERE p.id = auth.uid()))
      AND (full_name IS NOT NULL)
    )
    ELSE false
  END
);

-- Also restrict the SELECT policy on profiles to authenticated
DROP POLICY IF EXISTS "App users can view profiles" ON public.profiles;
CREATE POLICY "App users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_app_user(auth.uid()));