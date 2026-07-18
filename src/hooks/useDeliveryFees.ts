import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryFee {
  id: string;
  wilaya_code: string;
  wilaya_name: string;
  home_delivery_fee: number;
  stop_desk_fee: number;
  created_at: string;
  updated_at: string;
}

export function useDeliveryFees() {
  return useQuery({
    queryKey: ['delivery-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_fees')
        .select('*')
        .order('wilaya_code', { ascending: true });

      if (error) throw error;
      
      // Sort by numeric code
      return (data as DeliveryFee[]).sort((a, b) => 
        parseInt(a.wilaya_code) - parseInt(b.wilaya_code)
      );
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateDeliveryFee() {
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
        .from('delivery_fees')
        .update({ home_delivery_fee, stop_desk_fee })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-fees'] });
      toast.success('Tarif mis à jour avec succès');
    },
    onError: (error) => {
      console.error('Error updating delivery fee:', error);
      toast.error('Erreur lors de la mise à jour du tarif');
    },
  });
}

export function useDeliveryFeeByWilaya(wilayaCode: string | null) {
  const { data: fees } = useDeliveryFees();
  
  if (!wilayaCode || !fees) return null;
  
  // Extract code from "16 - Alger" format
  const code = wilayaCode.split(' - ')[0].trim();
  return fees.find(f => f.wilaya_code === code) || null;
}
