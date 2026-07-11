-- Add preparing_at column for accurate "Préparation" filtering
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preparing_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_preparing_at ON public.orders(preparing_at);

-- Trigger function: set preparing_at when entering preparing/ready, clear when leaving
CREATE OR REPLACE FUNCTION public.set_preparing_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('preparing','ready')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.preparing_at := now();
  ELSIF NEW.status NOT IN ('preparing','ready')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.preparing_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_preparing_at ON public.orders;
CREATE TRIGGER trg_set_preparing_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_preparing_at_on_status();

-- Backfill: use latest order_history transition into preparing/ready, fallback to updated_at
UPDATE public.orders o
SET preparing_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
    WHERE oh.order_id = o.id AND oh.new_status IN ('preparing','ready')),
  o.updated_at
)
WHERE o.status IN ('preparing','ready') AND o.preparing_at IS NULL;