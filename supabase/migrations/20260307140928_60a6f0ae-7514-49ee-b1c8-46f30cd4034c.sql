
CREATE OR REPLACE FUNCTION public.update_order_status_attributed(
  _order_id uuid,
  _status text,
  _changed_by text,
  _delivered_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.changed_by', _changed_by, true);
  
  IF _delivered_at IS NOT NULL THEN
    UPDATE orders SET status = _status::order_status, delivered_at = _delivered_at WHERE id = _order_id;
  ELSE
    UPDATE orders SET status = _status::order_status WHERE id = _order_id;
  END IF;
END;
$$;
