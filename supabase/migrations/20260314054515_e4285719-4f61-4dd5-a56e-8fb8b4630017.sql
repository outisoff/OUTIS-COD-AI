CREATE TABLE public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  has_whatsapp BOOLEAN NOT NULL DEFAULT true,
  contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read whatsapp_contacts"
  ON public.whatsapp_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage whatsapp_contacts"
  ON public.whatsapp_contacts FOR ALL USING (true) WITH CHECK (true);