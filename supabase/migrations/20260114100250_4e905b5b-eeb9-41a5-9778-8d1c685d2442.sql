-- Create integrations table to store API keys and settings
CREATE TABLE public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type text NOT NULL,
  name text NOT NULL,
  api_key text,
  api_secret text,
  webhook_url text,
  spreadsheet_id text,
  store_url text,
  is_enabled boolean NOT NULL DEFAULT false,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(integration_type, name)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage integrations
CREATE POLICY "Admins can view integrations"
ON public.integrations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert integrations"
ON public.integrations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update integrations"
ON public.integrations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete integrations"
ON public.integrations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();