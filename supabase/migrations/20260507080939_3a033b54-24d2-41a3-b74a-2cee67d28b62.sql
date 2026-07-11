CREATE OR REPLACE FUNCTION public.set_returned_at_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Set returned_at the FIRST time the order enters the return group, keep it stable afterwards
  IF NEW.status IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.returned_at IS NULL THEN
    NEW.returned_at := now();
  -- Clear only when leaving the return group entirely
  ELSIF NEW.status NOT IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.returned_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;