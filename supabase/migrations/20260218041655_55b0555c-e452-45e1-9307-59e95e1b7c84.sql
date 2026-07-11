-- Drop the existing broad SELECT policy for orders
DROP POLICY IF EXISTS "App users can view orders" ON public.orders;

-- Admins can view ALL orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Confirmateurs can only see orders assigned to them
CREATE POLICY "Confirmateurs can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role) 
  AND assigned_agent = (
    SELECT COALESCE(full_name, email) 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Stock managers can view all orders (read-only for stock tracking)
CREATE POLICY "Stock managers can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'stock_manager'::app_role));