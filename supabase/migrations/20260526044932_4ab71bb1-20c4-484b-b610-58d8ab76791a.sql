ALTER TABLE public.charges DROP CONSTRAINT IF EXISTS charges_frequency_check;
ALTER TABLE public.charges ADD CONSTRAINT charges_frequency_check CHECK (frequency = ANY (ARRAY['one_time'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text, 'per_order'::text, 'per_product'::text]));
ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS product_ids uuid[];
CREATE INDEX IF NOT EXISTS idx_charges_product_ids ON public.charges USING GIN (product_ids);