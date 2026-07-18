-- Auto-set confirmed_at when status becomes 'confirmed'
CREATE OR REPLACE FUNCTION public.set_confirmed_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_confirmed_at_trigger ON public.orders;
CREATE TRIGGER set_confirmed_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_confirmed_at_on_status();

-- Auto-set shipped_at when status enters shipping group (first time only)
CREATE OR REPLACE FUNCTION public.set_shipped_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('shipped','to_station','at_station','au_bureau','en_livraison')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shipped_at_trigger ON public.orders;
CREATE TRIGGER set_shipped_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_shipped_at_on_status();