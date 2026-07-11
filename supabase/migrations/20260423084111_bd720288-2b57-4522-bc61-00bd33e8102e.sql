DELETE FROM public.order_history a
WHERE a.changed_by = 'Système'
  AND EXISTS (
    SELECT 1 FROM public.order_history b
    WHERE b.order_id = a.order_id
      AND b.old_status = a.old_status
      AND b.new_status = a.new_status
      AND b.changed_by LIKE 'Livreur:%'
      AND abs(extract(epoch FROM (b.created_at - a.created_at))) < 5
  );