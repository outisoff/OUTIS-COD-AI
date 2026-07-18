import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SpecialDeliveryFee2 {
  id: string;
  wilaya_code: string;
  wilaya_name: string;
  home_delivery_fee: number;
  stop_desk_fee: number;
  created_at: string;
  updated_at: string;
}

export function useSpecialDeliveryFees2() {
  return useQuery({
    queryKey: ['special-delivery-fees-2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('special_delivery_fees_2')
        .select('*')
        .order('wilaya_code', { ascending: true });

      if (error) throw error;
      
      return (data as SpecialDeliveryFee2[]).sort((a, b) => 
        parseInt(a.wilaya_code) - parseInt(b.wilaya_code)
      );
    },
  });
}

export function useUpdateSpecialDeliveryFee2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      home_delivery_fee, 
      stop_desk_fee 
    }: { 
      id: string; 
      home_delivery_fee: number; 
      stop_desk_fee: number;
    }) => {
      const { error } = await supabase
        .from('special_delivery_fees_2')
        .update({ home_delivery_fee, stop_desk_fee })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-delivery-fees-2'] });
      toast.success('Tarif mis à jour avec succès');
    },
    onError: (error) => {
      console.error('Error updating special delivery fee 2:', error);
      toast.error('Erreur lors de la mise à jour du tarif');
    },
  });
}
