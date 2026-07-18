
CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
  _auto_confirm_enabled boolean;
  _auto_confirm_raw jsonb;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  -- Skip if already assigned
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  -- On INSERT (new order): skip if AI auto-confirmation is enabled
  -- Let the AI try to confirm first; the edge function auto-assign-stale-orders
  -- will assign later if AI doesn't confirm within the stale delay
  IF TG_OP = 'INSERT' THEN
    SELECT setting_value INTO _auto_confirm_raw
    FROM automation_settings WHERE setting_key = 'auto_confirm';
    
    IF _auto_confirm_raw IS NOT NULL AND (_auto_confirm_raw->>'enabled')::boolean = true THEN
      -- AI confirmation is active, don't assign immediately
      RETURN NEW;
    END IF;
  END IF;

  -- Check working hours (Algeria = UTC+1)
  SELECT setting_value INTO _working_hours
  FROM assignment_settings WHERE setting_key = 'working_hours';
  
  _work_start := COALESCE((_working_hours->>'start')::int, 8);
  _work_end := COALESCE((_working_hours->>'end')::int, 20);
  _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

  IF _work_start < _work_end THEN
    _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
  ELSE
    _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
  END IF;

  IF NOT _is_during_work THEN RETURN NEW; END IF;

  -- Get active confirmateurs
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now());
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule' AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour AND _current_hour < end_hour
      ORDER BY priority ASC LIMIT 1;
    END IF;
  END IF;

  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;
