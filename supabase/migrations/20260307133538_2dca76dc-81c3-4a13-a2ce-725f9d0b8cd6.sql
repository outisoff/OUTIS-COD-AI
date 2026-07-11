
CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _changed_by text;
  _user_id uuid;
  _skip_trigger text;
  _duplicate_exists boolean;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Check if edge function wants to skip (it already inserted history manually)
    BEGIN
      _skip_trigger := current_setting('app.skip_order_history_trigger', true);
    EXCEPTION WHEN OTHERS THEN
      _skip_trigger := NULL;
    END;
    
    IF _skip_trigger = 'true' THEN
      RETURN NEW;
    END IF;

    -- Check for duplicate: same order, same transition, within last 3 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.order_history
      WHERE order_id = NEW.id
        AND old_status = OLD.status
        AND new_status = NEW.status
        AND created_at > (now() - interval '3 seconds')
    ) INTO _duplicate_exists;
    
    IF _duplicate_exists THEN
      RETURN NEW;
    END IF;

    _user_id := auth.uid();
    
    -- Check for session variable set by edge functions
    BEGIN
      _changed_by := current_setting('app.changed_by', true);
    EXCEPTION WHEN OTHERS THEN
      _changed_by := NULL;
    END;
    
    -- Determine changed_by label
    IF _changed_by IS NOT NULL AND _changed_by != '' THEN
      NULL; -- keep _changed_by as is
    ELSIF _user_id IS NOT NULL THEN
      _changed_by := NULL; -- will be resolved from user profile in UI
    ELSE
      _changed_by := 'Système';
    END IF;
    
    INSERT INTO public.order_history (order_id, old_status, new_status, changed_by, changed_by_user_id)
    VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      _changed_by,
      _user_id
    );
  END IF;
  RETURN NEW;
END;
$function$;
