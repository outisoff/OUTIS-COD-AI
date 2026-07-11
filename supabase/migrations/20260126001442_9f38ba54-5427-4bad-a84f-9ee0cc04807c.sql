-- Create a second special delivery fees table
CREATE TABLE public.special_delivery_fees_2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  home_delivery_fee NUMERIC NOT NULL DEFAULT 0,
  stop_desk_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wilaya_code)
);

-- Enable RLS
ALTER TABLE public.special_delivery_fees_2 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "App users can view special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR SELECT 
USING (is_app_user(auth.uid()));

CREATE POLICY "Admins can insert special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_special_delivery_fees_2_updated_at
BEFORE UPDATE ON public.special_delivery_fees_2
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();