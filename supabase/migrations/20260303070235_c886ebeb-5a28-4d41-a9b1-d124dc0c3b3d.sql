
-- Create product packs table
CREATE TABLE public.product_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  
  -- Conditions
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 2,
  
  -- Multi-product pack (optional): list of product IDs that must ALL be in cart
  required_product_ids uuid[] DEFAULT '{}',
  
  -- Rewards
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed_amount', 'fixed_price'
  discount_value numeric NOT NULL DEFAULT 0,
  free_delivery boolean NOT NULL DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_packs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage product packs"
ON public.product_packs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view product packs"
ON public.product_packs FOR SELECT
USING (is_app_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_product_packs_updated_at
BEFORE UPDATE ON public.product_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
