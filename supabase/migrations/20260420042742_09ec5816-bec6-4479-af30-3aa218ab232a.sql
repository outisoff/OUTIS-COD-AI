DELETE FROM public.customers c
WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_phone = c.phone);