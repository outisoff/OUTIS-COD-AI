
-- 1. Add new column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_paid_at timestamp with time zone;

-- 2. Trigger function: set delivered_paid_at the first time the order enters delivered_paid
CREATE OR REPLACE FUNCTION public.set_delivered_paid_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'delivered_paid'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.delivered_paid_at IS NULL THEN
    NEW.delivered_paid_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_set_delivered_paid_at ON public.orders;
CREATE TRIGGER trg_set_delivered_paid_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivered_paid_at_on_status();

-- 4. Backfill existing delivered_paid orders
UPDATE public.orders
SET delivered_paid_at = COALESCE(updated_at, delivered_at, now())
WHERE status = 'delivered_paid'
  AND delivered_paid_at IS NULL;
