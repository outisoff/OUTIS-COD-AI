
-- 1) Race-safe order numbers via SEQUENCE
CREATE SEQUENCE IF NOT EXISTS public.orders_number_seq;

-- Seed sequence above the current max so we never collide with existing ORD-XXXXX
SELECT setval(
  'public.orders_number_seq',
  GREATEST(
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER))
      FROM public.orders
      WHERE order_number ~ '^ORD-[0-9]+$'
    ), 0),
    1
  ),
  true
);

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('public.orders_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Tracking-number lookup index (used by webhooks and the global search)
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number
  ON public.orders (tracking_number)
  WHERE tracking_number IS NOT NULL;

-- 3) Realtime: full row payloads + publication for profile approval flips
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END $$;

-- 4) Centralized internal HTTP-call helper so URL/anon-key live in one place
--    (replaces the literals duplicated across every trigger_* function)
CREATE OR REPLACE FUNCTION public.call_internal_function(
  _function_name text,
  _payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _internal_secret text;
BEGIN
  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  SELECT setting_value->>'value' INTO _internal_secret
  FROM public.automation_settings
  WHERE setting_key = 'internal_trigger_secret';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/' || _function_name,
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-internal-secret', COALESCE(_internal_secret, '')
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.call_internal_function(text, jsonb) FROM PUBLIC, anon, authenticated;

-- 5) Refactor existing triggers to use the helper (single source of truth)
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _confirmation_enabled boolean;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings WHERE setting_key = 'confirmation';

  IF COALESCE(_confirmation_enabled, false) = false THEN RETURN NEW; END IF;
  IF NEW.status != 'new' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'auto-confirm-orders',
    jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_check_whatsapp_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing boolean;
BEGIN
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

  SELECT EXISTS (SELECT 1 FROM whatsapp_contacts WHERE phone = NEW.customer_phone) INTO _existing;
  IF _existing THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'wasender-check-whatsapp',
    jsonb_build_object('phone', NEW.customer_phone)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_check_whatsapp error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_zr_express_create_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'preparing' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'preparing' THEN RETURN NEW; END IF;
  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'zr-express-create-order',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_zr_express_cancel_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'erreur' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'zr-express-cancel-order',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'to_station' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN RETURN NEW; END IF;
  IF NEW.tracking_number IS NULL THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'zr-express-ready',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_ecotrack_cancel_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'erreur' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'ecotrack-cancel-order',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;
