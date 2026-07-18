
-- Drop existing policies on whatsapp_contacts
DROP POLICY IF EXISTS "Authenticated users can read whatsapp_contacts" ON whatsapp_contacts;
DROP POLICY IF EXISTS "Service role can manage whatsapp_contacts" ON whatsapp_contacts;

-- Create new stricter policies
CREATE POLICY "Authenticated users can view whatsapp contacts"
ON whatsapp_contacts FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert whatsapp contacts"
ON whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp contacts"
ON whatsapp_contacts FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete whatsapp contacts"
ON whatsapp_contacts FOR DELETE TO authenticated
USING (true);
