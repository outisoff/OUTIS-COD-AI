
-- Tighten write policies to app_user only (admins + approved users)
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp contacts" ON whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp contacts" ON whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp contacts" ON whatsapp_contacts;

CREATE POLICY "App users can insert whatsapp contacts"
ON whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (is_app_user(auth.uid()));

CREATE POLICY "App users can update whatsapp contacts"
ON whatsapp_contacts FOR UPDATE TO authenticated
USING (is_app_user(auth.uid()));

CREATE POLICY "Admins can delete whatsapp contacts"
ON whatsapp_contacts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));
