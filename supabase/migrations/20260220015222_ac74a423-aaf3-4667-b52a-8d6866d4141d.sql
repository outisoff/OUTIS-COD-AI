
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;
