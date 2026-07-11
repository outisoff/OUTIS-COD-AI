
ALTER TABLE public.product_packs 
ADD COLUMN gift_product_id uuid REFERENCES public.products(id) DEFAULT NULL,
ADD COLUMN gift_quantity integer NOT NULL DEFAULT 0;
