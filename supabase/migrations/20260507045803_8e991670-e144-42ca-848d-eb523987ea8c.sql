
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_cancelled_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('cancelled','wrong_number','out_of_stock','no_answer')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status NOT IN ('cancelled','wrong_number','out_of_stock','no_answer')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cancelled_at ON public.orders;
CREATE TRIGGER trg_set_cancelled_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_cancelled_at_on_status();

-- Backfill existing cancelled orders
UPDATE public.orders o
SET cancelled_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
   WHERE oh.order_id = o.id
     AND oh.new_status IN ('cancelled','wrong_number','out_of_stock','no_answer')),
  o.updated_at
)
WHERE o.status IN ('cancelled','wrong_number','out_of_stock','no_answer')
  AND o.cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON public.orders(cancelled_at);
