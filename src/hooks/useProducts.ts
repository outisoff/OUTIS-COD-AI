import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { productInsertSchema, productUpdateSchema } from '@/lib/validation';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export function useProducts(enabled: boolean = true) {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          ai_confirmation, average_purchase_price, barcode, category, created_at,
          current_stock, custom_home_delivery_fee, custom_stop_desk_fee,
          delivery_pricing_tier, description, free_delivery, id, name,
          purchase_price, reorder_level, reserved_stock, selling_price, sku,
          store_id, updated_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}


export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: ProductInsert & { ai_confirmation?: boolean }) => {
      // Validate input before database insertion
      const validated = productInsertSchema.parse(product);
      
      const { data, error } = await supabase
        .from('products')
        .insert(validated as ProductInsert)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...product }: ProductUpdate & { id: string } & { ai_confirmation?: boolean }) => {
      // Validate input before database update
      const validated = productUpdateSchema.parse({ id, ...product });
      const { id: validatedId, ...updateData } = validated;
      
      const { data, error } = await supabase
        .from('products')
        .update(updateData as ProductUpdate)
        .eq('id', validatedId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useLowStockProducts() {
  const query = useProducts();
  return {
    ...query,
    data: query.data
      ?.filter(product => (product.current_stock - product.reserved_stock) <= product.reorder_level)
      .sort((a, b) => a.current_stock - b.current_stock),
  };
}
