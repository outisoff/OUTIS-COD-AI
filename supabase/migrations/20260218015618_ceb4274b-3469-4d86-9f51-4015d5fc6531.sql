
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create trigger function to auto-call confirmation edge function
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
BEGIN
  -- Check if auto-confirmation is enabled
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  -- Only proceed if enabled (default to false if not found)
  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  -- Only trigger for orders with status 'new'
  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from config
  _base_url := 'https://csllsbgiorpvzqrtijfv.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGxzYmdpb3JwdnpxcnRpamZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExOTAzNjYsImV4cCI6MjA4Njc2NjM2Nn0.6hsm-x_AOX12lUkUxTYTwLu6JycAHM72AXrIT7OpvdQ';

  -- Call the edge function asynchronously via pg_net
  PERFORM extensions.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS on_new_order_auto_confirm ON public.orders;
CREATE TRIGGER on_new_order_auto_confirm
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_confirm_order();
