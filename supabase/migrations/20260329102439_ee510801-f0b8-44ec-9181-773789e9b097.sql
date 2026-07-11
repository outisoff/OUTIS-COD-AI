
-- Fix 1: Tighten profiles UPDATE policy so unapproved users cannot update their profile at all
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO public
USING (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN id = auth.uid() THEN is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN id = auth.uid() THEN (NOT (is_approved IS DISTINCT FROM (SELECT p.is_approved FROM profiles p WHERE p.id = auth.uid())))
    ELSE false
  END
);

-- Fix 2: Add explicit restrictive UPDATE policy on stock_movements to deny all updates
CREATE POLICY "No updates allowed on stock movements"
ON stock_movements FOR UPDATE TO public
USING (false)
WITH CHECK (false);
