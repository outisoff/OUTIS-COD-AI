SELECT public.update_order_status_attributed(
  (SELECT id FROM public.orders WHERE order_number = 'LF-5961'),
  'delivered',
  'Système (sync manuelle ZR)',
  now()
);

UPDATE public.deliveries
SET delivery_status = 'Livré',
    delivery_situation = 'Livré',
    last_update = now()
WHERE order_id = (SELECT id FROM public.orders WHERE order_number = 'LF-5961');
