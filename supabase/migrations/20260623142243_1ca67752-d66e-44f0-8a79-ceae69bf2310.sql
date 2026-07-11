INSERT INTO public.automation_settings (setting_key, setting_value)
VALUES (
  'internal_trigger_secret',
  jsonb_build_object('value', encode(gen_random_bytes(32), 'hex'))
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = jsonb_build_object('value', encode(gen_random_bytes(32), 'hex'));

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
  _internal_secret text;
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

  _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';

  SELECT setting_value->>'value' INTO _internal_secret
  FROM public.automation_settings
  WHERE setting_key = 'internal_trigger_secret';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-internal-secret', COALESCE(_internal_secret, '')
    )
  );

  RETURN NEW;
END;
$function$;
