
CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  charge_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage charges" ON public.charges
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view charges" ON public.charges
  FOR SELECT TO authenticated
  USING (is_app_user(auth.uid()));
