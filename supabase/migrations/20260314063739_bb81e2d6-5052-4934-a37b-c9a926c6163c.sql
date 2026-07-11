
CREATE OR REPLACE FUNCTION public.trigger_check_whatsapp_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _existing boolean;
BEGIN
  -- Only on INSERT
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Skip if phone already cached
  SELECT EXISTS (
    SELECT 1 FROM whatsapp_contacts WHERE phone = NEW.customer_phone
  ) INTO _existing;

  IF _existing THEN
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

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/wasender-check-whatsapp',
    body := jsonb_build_object('phone', NEW.customer_phone),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_check_whatsapp error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- Create the trigger on orders table
DROP TRIGGER IF EXISTS trg_check_whatsapp_on_order ON orders;
CREATE TRIGGER trg_check_whatsapp_on_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_whatsapp_on_order();
