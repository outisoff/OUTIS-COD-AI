
-- Store Meta/Facebook integration credentials
CREATE TABLE public.meta_integration (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text,
  app_id text,
  app_secret_encrypted text,
  page_access_token_encrypted text,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_connected boolean NOT NULL DEFAULT false,
  instagram_connected boolean NOT NULL DEFAULT false,
  facebook_connected boolean NOT NULL DEFAULT false,
  auto_reply_comments boolean NOT NULL DEFAULT true,
  auto_reply_messages boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_integration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta integration" ON public.meta_integration
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert meta integration" ON public.meta_integration
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update meta integration" ON public.meta_integration
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete meta integration" ON public.meta_integration
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_meta_integration_updated_at
  BEFORE UPDATE ON public.meta_integration
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
