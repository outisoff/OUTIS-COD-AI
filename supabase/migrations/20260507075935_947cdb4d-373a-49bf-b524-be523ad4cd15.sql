
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.set_returned_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.returned_at IS NULL THEN
    NEW.returned_at := now();
  ELSIF NEW.status NOT IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.returned_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_returned_at_trigger ON public.orders;
CREATE TRIGGER set_returned_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_returned_at_on_status();

-- Backfill: for existing returned/échec orders, set returned_at from updated_at
UPDATE public.orders
SET returned_at = updated_at
WHERE status IN ('Échec_de_livraison', 'returned')
  AND returned_at IS NULL;
