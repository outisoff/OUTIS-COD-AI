
-- Create table for multiple Meta pages/accounts
CREATE TABLE public.meta_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id uuid REFERENCES public.meta_integration(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  page_name text NOT NULL,
  page_id text NOT NULL,
  page_access_token text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta pages" ON public.meta_pages
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert meta pages" ON public.meta_pages
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update meta pages" ON public.meta_pages
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete meta pages" ON public.meta_pages
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_meta_pages_updated_at
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
