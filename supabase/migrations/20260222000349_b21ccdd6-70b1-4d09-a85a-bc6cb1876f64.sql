
CREATE OR REPLACE FUNCTION public.trigger_ecotrack_cancel_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Only trigger when status changes TO 'erreur'
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  -- Skip if old status was already 'erreur'
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/ecotrack-cancel-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Create the trigger on orders table
CREATE TRIGGER trigger_ecotrack_cancel_on_erreur
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ecotrack_cancel_order();
