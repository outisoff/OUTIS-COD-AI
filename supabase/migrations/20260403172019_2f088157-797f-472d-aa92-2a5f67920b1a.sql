
-- Performance indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_agent ON public.orders USING btree (assigned_agent);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders USING btree (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_company ON public.orders USING btree (delivery_company);
CREATE INDEX IF NOT EXISTS idx_orders_wilaya ON public.orders USING btree (wilaya);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders USING btree (status, created_at DESC);

-- Performance indexes for order_items table
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items USING btree (product_id);

-- Performance indexes for order_history table
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON public.order_history USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON public.order_history USING btree (created_at DESC);

-- Performance indexes for stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements USING btree (reference);

-- Performance indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers USING btree (status);

-- Performance indexes for deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries USING btree (order_id);

-- Performance indexes for charges
CREATE INDEX IF NOT EXISTS idx_charges_charge_date ON public.charges USING btree (charge_date);
