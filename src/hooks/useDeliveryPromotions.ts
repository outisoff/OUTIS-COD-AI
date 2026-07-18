import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryPromotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  applies_to: 'all' | 'home' | 'stop_desk';
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DeliveryPromotionInsert = Omit<DeliveryPromotion, 'id' | 'created_at' | 'updated_at'>;

export function useDeliveryPromotions() {
  return useQuery({
    queryKey: ['delivery-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DeliveryPromotion[];
    },
  });
}

export function useActiveDeliveryPromotions() {
  return useQuery({
    queryKey: ['delivery-promotions', 'active'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('delivery_promotions')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);

      if (error) throw error;
      return data as DeliveryPromotion[];
    },
  });
}

export function useCreateDeliveryPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (promotion: DeliveryPromotionInsert) => {
      const { data, error } = await supabase
        .from('delivery_promotions')
        .insert(promotion)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-promotions'] });
      toast.success('Promotion créée avec succès');
    },
    onError: (error) => {
      console.error('Error creating promotion:', error);
      toast.error('Erreur lors de la création de la promotion');
    },
  });
}

export function useUpdateDeliveryPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeliveryPromotion> & { id: string }) => {
      const { error } = await supabase
        .from('delivery_promotions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-promotions'] });
      toast.success('Promotion mise à jour avec succès');
    },
    onError: (error) => {
      console.error('Error updating promotion:', error);
      toast.error('Erreur lors de la mise à jour de la promotion');
    },
  });
}

export function useDeleteDeliveryPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delivery_promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-promotions'] });
      toast.success('Promotion supprimée avec succès');
    },
    onError: (error) => {
      console.error('Error deleting promotion:', error);
      toast.error('Erreur lors de la suppression de la promotion');
    },
  });
}

// Helper function to calculate discounted delivery fee
export function calculateDiscountedFee(
  baseFee: number,
  promotion: DeliveryPromotion | null,
  deliveryType: 'home' | 'stop_desk'
): number {
  if (!promotion) return baseFee;
  
  // Check if promotion applies to this delivery type
  if (promotion.applies_to !== 'all' && promotion.applies_to !== deliveryType) {
    return baseFee;
  }

  if (promotion.discount_type === 'percentage') {
    return Math.max(0, baseFee * (1 - promotion.discount_value / 100));
  } else {
    return Math.max(0, baseFee - promotion.discount_value);
  }
}
