-- Create table for temporary delivery promotions
CREATE TABLE public.delivery_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('all', 'home', 'stop_desk')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_promotions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for delivery_promotions
CREATE POLICY "Admins can delete delivery promotions" 
ON public.delivery_promotions FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert delivery promotions" 
ON public.delivery_promotions FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery promotions" 
ON public.delivery_promotions FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view delivery promotions" 
ON public.delivery_promotions FOR SELECT 
USING (is_app_user(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_promotions_updated_at
BEFORE UPDATE ON public.delivery_promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add product-specific delivery fees columns to products table
ALTER TABLE public.products 
ADD COLUMN custom_home_delivery_fee NUMERIC DEFAULT NULL,
ADD COLUMN custom_stop_desk_fee NUMERIC DEFAULT NULL;