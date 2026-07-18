
-- Add date columns to assignment_rules for date_period rule type
ALTER TABLE public.assignment_rules
ADD COLUMN start_date timestamp with time zone,
ADD COLUMN end_date timestamp with time zone;

-- Update the auto_assign_order function to support date_period rules
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
BEGIN
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  
  IF NOT _auto_enabled THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  -- Try rules (source, product, date_period) for rules or combined mode
  IF _mode IN ('rules', 'combined') THEN
    -- Try source rules first
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- Try date_period rules if no source match
    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'date_period' 
        AND is_active = true
        AND start_date <= now()
        AND end_date >= now()
      ORDER BY priority ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback: workload or round-robin
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      _min_agent := NULL;
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
