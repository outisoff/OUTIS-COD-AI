
-- Update the trigger function to generate sequential order numbers like ORD-00001
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get the max current sequential number
  SELECT COALESCE(MAX(
    CASE 
      WHEN order_number ~ '^ORD-[0-9]+$' 
      THEN CAST(SUBSTRING(order_number FROM 5) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1
  INTO next_num
  FROM orders;
  
  NEW.order_number = 'ORD-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$function$;

-- Update existing orders with sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM orders
)
UPDATE orders 
SET order_number = 'ORD-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE orders.id = numbered.id;
