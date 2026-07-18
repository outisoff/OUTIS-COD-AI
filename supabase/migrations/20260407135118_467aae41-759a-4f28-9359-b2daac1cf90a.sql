
-- Fix overbroad confirmateur access to meta_conversations
-- Drop the old policy and create a properly scoped one
DROP POLICY IF EXISTS "Confirmateurs can view meta conversations" ON public.meta_conversations;

CREATE POLICY "Confirmateurs can view meta conversations"
ON public.meta_conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.assigned_agent = (
      SELECT COALESCE(p.full_name, p.email)
      FROM profiles p
      WHERE p.id = auth.uid()
    )
    AND o.customer_phone IS NOT NULL
    AND o.customer_phone = meta_conversations.sender_id
  )
);
