
-- Fix whatsapp_contacts SELECT policy: restrict to app users only
DROP POLICY IF EXISTS "Authenticated users can view whatsapp contacts" ON whatsapp_contacts;

CREATE POLICY "App users can view whatsapp contacts"
ON whatsapp_contacts FOR SELECT TO authenticated
USING (is_app_user(auth.uid()));
