-- Tighten profile update checks to prevent self-approval and add missing INSERT policy

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Prevent non-admin users from setting is_approved=true on UPDATE
ALTER POLICY "Users can update profiles"
ON public.profiles
USING (
  (id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (
    id = auth.uid()
    AND coalesce(is_approved, false) = false
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow users to create their own profile row (but never approved on insert)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  AND coalesce(is_approved, false) = false
);
