-- Function: auto-fill delivered_at when status becomes delivered or delivered_paid
CREATE OR REPLACE FUNCTION public.set_delivered_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('delivered', 'delivered_paid')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on orders update
DROP TRIGGER IF EXISTS trg_set_delivered_at ON public.orders;
CREATE TRIGGER trg_set_delivered_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_delivered_at_on_status();

-- Backfill missing delivered_at using the most recent matching status change in order_history
UPDATE public.orders o
SET delivered_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
    WHERE oh.order_id = o.id AND oh.new_status IN ('delivered', 'delivered_paid')),
  o.updated_at
)
WHERE o.status IN ('delivered', 'delivered_paid')
  AND o.delivered_at IS NULL;