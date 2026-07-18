-- Add delivery pricing tier to products
ALTER TABLE public.products 
ADD COLUMN delivery_pricing_tier TEXT NOT NULL DEFAULT 'standard';

-- Add comment for documentation
COMMENT ON COLUMN public.products.delivery_pricing_tier IS 'Delivery pricing tier: standard, special_1, special_2, or free';