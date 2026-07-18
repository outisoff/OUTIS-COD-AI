CREATE TABLE public.charge_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  icon TEXT NOT NULL DEFAULT 'LayoutGrid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage charge categories"
ON public.charge_categories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view charge categories"
ON public.charge_categories
FOR SELECT
TO authenticated
USING (is_app_user(auth.uid()));

CREATE TRIGGER update_charge_categories_updated_at
BEFORE UPDATE ON public.charge_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();