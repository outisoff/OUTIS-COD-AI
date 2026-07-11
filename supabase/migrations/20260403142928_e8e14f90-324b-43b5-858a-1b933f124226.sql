
-- Update trigger_auto_confirm_order with new project URL and anon key
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

  _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';

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

-- Update trigger_check_whatsapp_on_order with new project URL and anon key
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
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM whatsapp_contacts WHERE phone = NEW.customer_phone
  ) INTO _existing;

  IF _existing THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
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

-- Update trigger_ecotrack_cancel_order with new project URL and anon key
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
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
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

-- Update trigger_notify_livreur with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_notify_livreur()
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
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NOT starts_with(NEW.delivery_company, 'local:') THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object(
    'record', row_to_json(NEW)::jsonb,
    'old_record', row_to_json(OLD)::jsonb
  );

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/notify-livreur',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_notify_livreur error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- Update trigger_zr_express_cancel_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_zr_express_cancel_order()
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
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-cancel-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Update trigger_zr_express_create_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_zr_express_create_order()
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
  IF NEW.status != 'preparing' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'preparing' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-create-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Update trigger_zr_express_ready with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
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
  IF NEW.status != 'to_station' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  IF NEW.tracking_number IS NULL THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-ready',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;
