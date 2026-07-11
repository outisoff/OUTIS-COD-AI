SELECT public.update_order_status_attributed(
  (SELECT id FROM orders WHERE order_number='ORD-00413'),
  'delivered',
  'Correction manuelle (race condition)',
  now()
);