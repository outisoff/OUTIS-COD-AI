-- Add purchase_price column to stock_movements for tracking entry prices
ALTER TABLE public.stock_movements 
ADD COLUMN purchase_price numeric DEFAULT NULL;

-- Add average_purchase_price column to products for storing calculated average
ALTER TABLE public.products 
ADD COLUMN average_purchase_price numeric DEFAULT 0;