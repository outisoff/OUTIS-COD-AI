-- Tighten profiles self-update policy to make approval-state immutability explicit for non-admin users
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN id = auth.uid() THEN public.is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN id = auth.uid() THEN (
      is_approved = (
        SELECT p.is_approved
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
    )
    ELSE false
  END
);