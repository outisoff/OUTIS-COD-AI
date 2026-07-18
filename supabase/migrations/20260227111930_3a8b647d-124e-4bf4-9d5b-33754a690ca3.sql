
-- Allow admins and stock managers to delete stock movements
CREATE POLICY "Admins can delete stock movements"
ON public.stock_movements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Stock managers can delete stock movements"
ON public.stock_movements
FOR DELETE
USING (has_role(auth.uid(), 'stock_manager'::app_role));
