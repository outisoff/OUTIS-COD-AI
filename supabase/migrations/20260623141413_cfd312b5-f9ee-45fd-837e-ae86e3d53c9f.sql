
-- Tighten meta_messages confirmateur policy to match meta_conversations scoping
DROP POLICY IF EXISTS "Confirmateurs can view meta messages" ON public.meta_messages;
CREATE POLICY "Confirmateurs can view meta messages"
ON public.meta_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.meta_conversations mc
    JOIN public.orders o
      ON o.customer_phone IS NOT NULL
     AND o.customer_phone = mc.sender_id
    WHERE mc.id = meta_messages.conversation_id
      AND o.assigned_agent = (
        SELECT COALESCE(p.full_name, p.email)
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
  )
);

-- Lock down SECURITY DEFINER functions exposed via the API
REVOKE EXECUTE ON FUNCTION public.update_order_status_attributed(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_app_user(uuid) FROM PUBLIC, anon;
