import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type StockMovementType = 'entry' | 'exit' | 'adjustment' | 'sale' | 'return';

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference: string | null;
  created_by: string | null;
  created_at: string;
  products?: {
    name: string;
    sku: string;
  };
}

export interface CreateStockMovement {
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reason?: string;
  reference?: string;
  purchase_price?: number;
}

export function useStockMovements() {
  return useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products (name, sku)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as StockMovement[];
    },
  });
}

export function useProductStockMovements(productId: string) {
  return useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as StockMovement[];
    },
    enabled: !!productId,
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (movement: CreateStockMovement) => {
      // First get current stock and average purchase price
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('current_stock, purchase_price, average_purchase_price')
        .eq('id', movement.product_id)
        .single();
      
      if (productError) throw productError;
      
      const previousStock = product.current_stock;
      const currentAvgPrice = product.average_purchase_price || product.purchase_price || 0;
      let newStock: number;
      let newAvgPrice = currentAvgPrice;
      
      // Calculate new stock based on movement type
      if (movement.movement_type === 'entry' || movement.movement_type === 'return') {
        newStock = previousStock + movement.quantity;
        
        // Calculate weighted average purchase price for entries
        if (movement.purchase_price && movement.purchase_price > 0) {
          const totalOldValue = previousStock * currentAvgPrice;
          const newEntryValue = movement.quantity * movement.purchase_price;
          newAvgPrice = newStock > 0 ? (totalOldValue + newEntryValue) / newStock : movement.purchase_price;
        }
      } else if (movement.movement_type === 'exit' || movement.movement_type === 'sale') {
        newStock = previousStock - movement.quantity;
        // Average price stays the same for exits
      } else {
        // adjustment - quantity is the new absolute value
        newStock = movement.quantity;
        // Keep current average price for adjustments
      }
      
      // Prepare update data
      const updateData: { current_stock: number; purchase_price?: number; average_purchase_price?: number } = { 
        current_stock: newStock,
        average_purchase_price: newAvgPrice
      };
      
      // Also update purchase_price if provided (latest purchase price)
      if (movement.movement_type === 'entry' && movement.purchase_price !== undefined && movement.purchase_price > 0) {
        updateData.purchase_price = movement.purchase_price;
      }
      
      // Update product stock and prices
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', movement.product_id);
      
      if (updateError) throw updateError;
      
      // Record the movement
      const { data, error } = await supabase
        .from('stock_movements')
        .insert({
          product_id: movement.product_id,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: movement.reason || null,
          reference: movement.reference || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
