
-- Fix: Restrict confirmateur SELECT on meta_messages to only messages in conversations they can access
-- And restrict confirmateur SELECT on meta_conversations to only conversations linked to orders assigned to them

-- Drop existing confirmateur policies
DROP POLICY IF EXISTS "Confirmateurs can view meta messages" ON public.meta_messages;
DROP POLICY IF EXISTS "Confirmateurs can view meta conversations" ON public.meta_conversations;

-- Recreate with scoped access: confirmateurs can only view meta_conversations
-- that have a sender matching a customer phone from orders assigned to them
CREATE POLICY "Confirmateurs can view meta conversations"
ON public.meta_conversations FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.assigned_agent = (
      SELECT COALESCE(p.full_name, p.email)
      FROM profiles p WHERE p.id = auth.uid()
    )
    AND o.customer_phone IS NOT NULL
  )
);

-- Confirmateurs can only view messages belonging to conversations they can access
CREATE POLICY "Confirmateurs can view meta messages"
ON public.meta_messages FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1 FROM meta_conversations mc
    WHERE mc.id = meta_messages.conversation_id
  )
);
