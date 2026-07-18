-- Remove client-side SELECT access to google_tokens
-- Tokens should only be accessed server-side via edge functions

-- Drop existing RLS policies for google_tokens
DROP POLICY IF EXISTS "Users can view their own Google tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Users can insert their own Google tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Users can update their own Google tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Users can delete their own Google tokens" ON public.google_tokens;

-- Create new restrictive policies
-- No SELECT policy for users - tokens should only be accessed server-side via service role
-- This prevents client-side JavaScript from querying tokens

-- Deny all client-side SELECT access
CREATE POLICY "No direct SELECT access to tokens"
ON public.google_tokens FOR SELECT
USING (false);

-- Deny client-side INSERT - tokens are saved by edge functions with service role
CREATE POLICY "No direct INSERT access to tokens"
ON public.google_tokens FOR INSERT
WITH CHECK (false);

-- Deny client-side UPDATE - tokens are updated by edge functions with service role
CREATE POLICY "No direct UPDATE access to tokens"
ON public.google_tokens FOR UPDATE
USING (false);

-- Deny client-side DELETE - tokens are deleted by edge functions with service role
CREATE POLICY "No direct DELETE access to tokens"
ON public.google_tokens FOR DELETE
USING (false);

-- Update customers table RLS to be more restrictive based on role
-- First, create a helper function to check if user has specific roles

-- Drop existing customer policies
DROP POLICY IF EXISTS "App users can view customers" ON public.customers;
DROP POLICY IF EXISTS "App users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "App users can update customers" ON public.customers;
DROP POLICY IF EXISTS "App users can delete customers" ON public.customers;

-- Create role-based customer access policies
-- Admins have full access to all customers
CREATE POLICY "Admins can view all customers"
ON public.customers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Confirmateurs can view customers for orders they're working on
CREATE POLICY "Confirmateurs can view customers"
ON public.customers FOR SELECT
USING (
  has_role(auth.uid(), 'confirmateur') AND
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.customer_id = customers.id
  )
);

-- Admins can insert customers
CREATE POLICY "Admins can insert customers"
ON public.customers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Confirmateurs can insert customers (when creating orders)
CREATE POLICY "Confirmateurs can insert customers"
ON public.customers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'confirmateur'));

-- Admins can update any customer
CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Confirmateurs can update customers they have orders for
CREATE POLICY "Confirmateurs can update customers"
ON public.customers FOR UPDATE
USING (
  has_role(auth.uid(), 'confirmateur') AND
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.customer_id = customers.id
  )
);

-- Only admins can delete customers
CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE
USING (has_role(auth.uid(), 'admin'));