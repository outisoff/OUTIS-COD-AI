
-- Function to recalculate customer stats from orders
CREATE OR REPLACE FUNCTION public.update_customer_stats(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET
    total_orders = COALESCE((
      SELECT COUNT(*) FROM orders 
      WHERE customer_id = p_customer_id 
      AND status NOT IN ('cancelled', 'duplicate')
    ), 0),
    total_spent = COALESCE((
      SELECT SUM(total_price) FROM orders 
      WHERE customer_id = p_customer_id 
      AND status IN ('delivered', 'delivered_paid')
    ), 0),
    last_order_date = (
      SELECT MAX(created_at) FROM orders 
      WHERE customer_id = p_customer_id
    ),
    updated_at = now()
  WHERE id = p_customer_id;
END;
$$;

-- Trigger function to auto-update customer stats when orders change
CREATE OR REPLACE FUNCTION public.trigger_update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM update_customer_stats(OLD.customer_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM update_customer_stats(NEW.customer_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id AND OLD.customer_id IS NOT NULL THEN
      PERFORM update_customer_stats(OLD.customer_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS orders_update_customer_stats ON orders;
CREATE TRIGGER orders_update_customer_stats
  AFTER INSERT OR UPDATE OF status, total_price, customer_id OR DELETE
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_customer_stats();

-- Backfill all existing customers with correct stats
UPDATE customers c
SET
  total_orders = COALESCE(s.order_count, 0),
  total_spent = COALESCE(s.spent, 0),
  last_order_date = s.last_date,
  updated_at = now()
FROM (
  SELECT 
    customer_id,
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'duplicate')) AS order_count,
    SUM(total_price) FILTER (WHERE status IN ('delivered', 'delivered_paid')) AS spent,
    MAX(created_at) AS last_date
  FROM orders
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) s
WHERE c.id = s.customer_id;
