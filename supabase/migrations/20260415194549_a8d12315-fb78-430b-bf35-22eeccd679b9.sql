WITH status_times AS (
  SELECT
    o.id,
    COALESCE(MAX(oh.created_at), o.created_at) AS corrected_updated_at
  FROM public.orders o
  LEFT JOIN public.order_history oh ON oh.order_id = o.id
  GROUP BY o.id, o.created_at
)
UPDATE public.orders o
SET updated_at = st.corrected_updated_at
FROM status_times st
WHERE o.id = st.id
  AND o.updated_at IS DISTINCT FROM st.corrected_updated_at;