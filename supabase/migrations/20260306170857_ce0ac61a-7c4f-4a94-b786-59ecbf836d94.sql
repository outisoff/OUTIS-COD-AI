
-- Create a trigger function that calls zr-express-ready when order status changes to 'to_station'
CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger for ZR Express orders transitioning to 'to_station'
  IF NEW.status = 'to_station' AND NEW.delivery_company = 'ZR Express'
     AND (OLD.status IS DISTINCT FROM 'to_station') THEN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/zr-express-ready',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_zr_express_ready_on_to_station ON public.orders;
CREATE TRIGGER trigger_zr_express_ready_on_to_station
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'to_station' AND OLD.status IS DISTINCT FROM 'to_station')
  EXECUTE FUNCTION public.trigger_zr_express_ready_order();
