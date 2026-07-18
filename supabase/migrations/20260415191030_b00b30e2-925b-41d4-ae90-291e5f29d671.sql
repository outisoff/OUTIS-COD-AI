ALTER TABLE public.products ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX idx_products_store_id ON public.products(store_id);