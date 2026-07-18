-- Table for auto-assignment rules
CREATE TABLE public.assignment_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('source', 'product')),
  agent_name TEXT NOT NULL,
  match_value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for assignment settings (round-robin counter, workload mode, etc.)
CREATE TABLE public.assignment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Initialize default settings
INSERT INTO public.assignment_settings (setting_key, setting_value)
VALUES 
  ('mode', '"round_robin"'::jsonb),
  ('round_robin_index', '0'::jsonb);

-- Enable RLS
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignment_rules
CREATE POLICY "Admins can manage assignment rules"
ON public.assignment_rules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Confirmateurs can view assignment rules"
ON public.assignment_rules FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'confirmateur'::app_role));

-- RLS Policies for assignment_settings
CREATE POLICY "Admins can manage assignment settings"
ON public.assignment_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Confirmateurs can view assignment settings"
ON public.assignment_settings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'confirmateur'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_assignment_rules_updated_at
BEFORE UPDATE ON public.assignment_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignment_settings_updated_at
BEFORE UPDATE ON public.assignment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();