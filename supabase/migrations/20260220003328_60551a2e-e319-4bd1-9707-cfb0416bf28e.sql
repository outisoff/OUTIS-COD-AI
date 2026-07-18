
-- Create deliveries table
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id),
  tracking_number text UNIQUE,
  carrier text DEFAULT 'zr_express',
  delivery_status text DEFAULT 'preparing',
  last_update timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id),
  type text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for deliveries
CREATE POLICY "App users can view deliveries" ON public.deliveries FOR SELECT USING (is_app_user(auth.uid()));
CREATE POLICY "App users can insert deliveries" ON public.deliveries FOR INSERT WITH CHECK (is_app_user(auth.uid()));
CREATE POLICY "App users can update deliveries" ON public.deliveries FOR UPDATE USING (is_app_user(auth.uid()));
CREATE POLICY "Admins can delete deliveries" ON public.deliveries FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for alerts
CREATE POLICY "App users can view alerts" ON public.alerts FOR SELECT USING (is_app_user(auth.uid()));
CREATE POLICY "App users can insert alerts" ON public.alerts FOR INSERT WITH CHECK (is_app_user(auth.uid()));
CREATE POLICY "App users can update alerts" ON public.alerts FOR UPDATE USING (is_app_user(auth.uid()));
CREATE POLICY "Admins can delete alerts" ON public.alerts FOR DELETE USING (has_role(auth.uid(), 'admin'));
