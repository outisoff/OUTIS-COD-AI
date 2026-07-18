
CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_history (order_id, old_status, new_status, changed_by, changed_by_user_id)
    VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      COALESCE(NEW.assigned_agent, CASE WHEN auth.uid() IS NULL THEN 'IA' ELSE NULL END),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;
