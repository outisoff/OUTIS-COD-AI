-- Create stores table
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (is_app_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add store_id to orders
ALTER TABLE public.orders
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;