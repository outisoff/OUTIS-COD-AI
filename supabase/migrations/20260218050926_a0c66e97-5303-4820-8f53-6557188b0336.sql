
-- Add auto_enabled setting
INSERT INTO assignment_settings (setting_key, setting_value)
VALUES ('auto_enabled', 'false')
ON CONFLICT DO NOTHING;

-- Create the auto-assign function
CREATE OR REPLACE FUNCTION public.auto_assign_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _rule RECORD;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT (setting_value)::boolean INTO _auto_enabled
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  
  IF NOT COALESCE(_auto_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Only auto-assign if no agent is set
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN
    RETURN NEW;
  END IF;

  -- Get confirmateur names
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get current mode
  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  -- Try rules (for rules or combined mode)
  IF _mode IN ('rules', 'combined') THEN
    -- Check source rules
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- If rules mode and no match, skip
    IF _mode = 'rules' AND _agent_name IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Fallback: workload or round-robin
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      -- Find agent with fewest active orders
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
      -- Round-robin
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_assign_order_trigger ON orders;
CREATE TRIGGER auto_assign_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_order();
