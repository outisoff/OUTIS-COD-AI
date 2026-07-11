
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "App users can view profiles"
ON public.profiles
FOR SELECT
USING (is_app_user(auth.uid()));
