ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pending_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_pending_at ON public.orders(pending_at);

CREATE OR REPLACE FUNCTION public.set_pending_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.pending_at := now();
  ELSIF NEW.status NOT IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.pending_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_pending_at ON public.orders;
CREATE TRIGGER trg_set_pending_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_at_on_status();

-- Initialize pending_at on insert for new pending orders
CREATE OR REPLACE FUNCTION public.set_pending_at_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
     AND NEW.pending_at IS NULL THEN
    NEW.pending_at := COALESCE(NEW.created_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_pending_at_insert ON public.orders;
CREATE TRIGGER trg_set_pending_at_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_at_on_insert();

-- Backfill existing pending orders
UPDATE public.orders o
SET pending_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
    WHERE oh.order_id = o.id
      AND oh.new_status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')),
  o.created_at
)
WHERE o.status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
  AND o.pending_at IS NULL;