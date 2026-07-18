-- Create table for delivery company fees per wilaya
CREATE TABLE public.delivery_company_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_company TEXT NOT NULL,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  home_delivery_fee NUMERIC NOT NULL DEFAULT 0,
  stop_desk_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(delivery_company, wilaya_code)
);

-- Enable RLS
ALTER TABLE public.delivery_company_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can delete delivery company fees" 
ON public.delivery_company_fees 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert delivery company fees" 
ON public.delivery_company_fees 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery company fees" 
ON public.delivery_company_fees 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view delivery company fees" 
ON public.delivery_company_fees 
FOR SELECT 
USING (is_app_user(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_company_fees_updated_at
BEFORE UPDATE ON public.delivery_company_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();