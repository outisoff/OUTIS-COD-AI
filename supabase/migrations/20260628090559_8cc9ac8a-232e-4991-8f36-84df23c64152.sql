CREATE INDEX IF NOT EXISTS idx_orders_confirmed_at ON public.orders (confirmed_at) WHERE confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON public.orders (delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivered_paid_at ON public.orders (delivered_paid_at) WHERE delivered_paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_returned_at ON public.orders (returned_at) WHERE returned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON public.orders (shipped_at) WHERE shipped_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders (updated_at);
-- Drop redundant duplicate (we already have idx_orders_status_created_at with same definition)
DROP INDEX IF EXISTS public.idx_orders_status_created;