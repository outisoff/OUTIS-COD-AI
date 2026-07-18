-- Drop the broken trigger that uses vault secrets (which don't exist)
DROP TRIGGER IF EXISTS trigger_zr_express_ready_on_to_station ON public.orders;

-- Drop the broken function
DROP FUNCTION IF EXISTS public.trigger_zr_express_ready_order();

-- Update the working trigger function to also handle 'to_station' (it already does via the function body)
-- The existing on_order_ready_zr_express trigger already fires on ALL updates and the function checks for ready/to_station