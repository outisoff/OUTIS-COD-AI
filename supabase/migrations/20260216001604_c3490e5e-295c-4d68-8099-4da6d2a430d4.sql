
-- Table to store automation settings (prompts, toggles, etc.)
CREATE TABLE public.automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can view automation settings"
ON public.automation_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert automation settings"
ON public.automation_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update automation settings"
ON public.automation_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete automation settings"
ON public.automation_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_automation_settings_updated_at
BEFORE UPDATE ON public.automation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
