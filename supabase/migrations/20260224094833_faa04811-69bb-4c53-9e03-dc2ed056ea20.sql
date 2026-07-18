
-- Create special_delivery_fees table (for pricing tier special_1)
CREATE TABLE public.special_delivery_fees (
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
ALTER TABLE public.special_delivery_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies matching other delivery fee tables
CREATE POLICY "Admins can delete special delivery fees"
  ON public.special_delivery_fees FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert special delivery fees"
  ON public.special_delivery_fees FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update special delivery fees"
  ON public.special_delivery_fees FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view special delivery fees"
  ON public.special_delivery_fees FOR SELECT
  USING (is_app_user(auth.uid()));

-- Populate with all 58 wilayas (same as delivery_fees)
INSERT INTO public.special_delivery_fees (wilaya_code, wilaya_name, home_delivery_fee, stop_desk_fee)
SELECT wilaya_code, wilaya_name, home_delivery_fee, stop_desk_fee
FROM public.delivery_fees;

-- Also update special_delivery_fees_2: set stop_desk_fee to 0 for "Gratuit au Bureau"
UPDATE public.special_delivery_fees_2 SET stop_desk_fee = 0;
