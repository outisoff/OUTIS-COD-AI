-- Create enum for stock movement types
CREATE TYPE public.stock_movement_type AS ENUM ('entry', 'exit', 'adjustment', 'sale', 'return');

-- Create stock_movements table to track all stock changes
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Create policies for stock_movements
CREATE POLICY "Admins can view all stock movements"
ON public.stock_movements
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Stock managers can view stock movements"
ON public.stock_movements
FOR SELECT
USING (has_role(auth.uid(), 'stock_manager'::app_role));

CREATE POLICY "Admins can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Stock managers can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'stock_manager'::app_role));

-- Create index for better query performance
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);