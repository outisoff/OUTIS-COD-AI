
-- Composite indexes for frequent query patterns

-- Orders: status + created_at (dashboard stats, filtered queries)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders (status, created_at DESC);

-- Orders: assigned_agent + status (agent performance, confirmation page)
CREATE INDEX IF NOT EXISTS idx_orders_agent_status ON public.orders (assigned_agent, status) WHERE assigned_agent IS NOT NULL;

-- Orders: delivery_company + status (delivery stats)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_company_status ON public.orders (delivery_company, status) WHERE delivery_company IS NOT NULL;

-- Orders: wilaya + status (wilaya-based reports)
CREATE INDEX IF NOT EXISTS idx_orders_wilaya_status ON public.orders (wilaya, status);

-- Orders: customer_phone (customer lookup, duplicate detection)
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);

-- Orders: source (source filtering)
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders (source);

-- Order items: order_id + product_id (joins, product filtering)
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON public.order_items (order_id, product_id);

-- Order history: order_id + created_at (status timeline)
CREATE INDEX IF NOT EXISTS idx_order_history_order_created ON public.order_history (order_id, created_at DESC);

-- Customers: phone (fast lookup)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);

-- Customers: status (filtering)
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers (status);

-- Stock movements: product_id + created_at (stock history)
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON public.stock_movements (product_id, created_at DESC);

-- Delivery company fees: company + wilaya (fee lookup)
CREATE INDEX IF NOT EXISTS idx_delivery_company_fees_lookup ON public.delivery_company_fees (delivery_company, wilaya_name);

-- Products: category (filtering)
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);
