ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_charges_store_id ON public.charges(store_id);
CREATE INDEX IF NOT EXISTS idx_charges_product_id ON public.charges(product_id);