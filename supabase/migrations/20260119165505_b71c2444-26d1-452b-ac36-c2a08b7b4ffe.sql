-- Add free_delivery column to products table
ALTER TABLE public.products 
ADD COLUMN free_delivery boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.products.free_delivery IS 'If true, orders containing this product get free delivery';