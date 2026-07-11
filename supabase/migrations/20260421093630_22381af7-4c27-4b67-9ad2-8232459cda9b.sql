-- Create charge_subcategories table
CREATE TABLE public.charge_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);

ALTER TABLE public.charge_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage charge subcategories"
ON public.charge_subcategories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view charge subcategories"
ON public.charge_subcategories
FOR SELECT
TO authenticated
USING (is_app_user(auth.uid()));

CREATE TRIGGER update_charge_subcategories_updated_at
BEFORE UPDATE ON public.charge_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add subcategory column to charges
ALTER TABLE public.charges ADD COLUMN subcategory TEXT;