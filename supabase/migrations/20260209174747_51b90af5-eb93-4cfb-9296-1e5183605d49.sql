
-- Rename the enum value from 'delivery_failed' to 'erreur'
ALTER TYPE public.order_status RENAME VALUE 'delivery_failed' TO 'erreur';

-- Update any existing orders with this status
UPDATE public.orders SET status = 'erreur' WHERE status = 'erreur';
