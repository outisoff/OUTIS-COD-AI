
-- Table for auto-confirmation logs
CREATE TABLE public.auto_confirmation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  ai_decision TEXT NOT NULL CHECK (ai_decision IN ('auto_confirm', 'ask_customer', 'reject')),
  ai_reason TEXT,
  checks_result JSONB DEFAULT '{}'::jsonb,
  whatsapp_message_sent BOOLEAN DEFAULT false,
  whatsapp_response TEXT,
  customer_reply TEXT,
  final_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_confirmation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view auto confirmation logs"
  ON public.auto_confirmation_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert auto confirmation logs"
  ON public.auto_confirmation_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage auto confirmation logs"
  ON public.auto_confirmation_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow edge function (service role) to insert
CREATE POLICY "Allow insert from service role"
  ON public.auto_confirmation_logs FOR INSERT
  WITH CHECK (true);

CREATE TRIGGER update_auto_confirmation_logs_updated_at
  BEFORE UPDATE ON public.auto_confirmation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
