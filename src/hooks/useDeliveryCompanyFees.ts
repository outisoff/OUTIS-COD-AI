import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryCompanyFee {
  id: string;
  delivery_company: string;
  wilaya_code: string;
  wilaya_name: string;
  home_delivery_fee: number;
  stop_desk_fee: number;
  return_fee: number;
  created_at: string;
  updated_at: string;
}

export function useDeliveryCompanyFees(deliveryCompany: string) {
  return useQuery({
    queryKey: ['delivery-company-fees', deliveryCompany],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_company_fees')
        .select('*')
        .eq('delivery_company', deliveryCompany)
        .order('wilaya_code', { ascending: true });

      if (error) throw error;
      
      // Sort by numeric code
      return (data as DeliveryCompanyFee[]).sort((a, b) => 
        parseInt(a.wilaya_code) - parseInt(b.wilaya_code)
      );
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: !!deliveryCompany,
  });
}

export function useUpdateDeliveryCompanyFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      home_delivery_fee, 
      stop_desk_fee,
      return_fee 
    }: { 
      id: string; 
      home_delivery_fee: number; 
      stop_desk_fee: number;
      return_fee: number;
    }) => {
      const { error } = await supabase
        .from('delivery_company_fees')
        .update({ home_delivery_fee, stop_desk_fee, return_fee })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-company-fees'] });
      toast.success('Tarif mis à jour avec succès');
    },
    onError: (error) => {
      console.error('Error updating delivery company fee:', error);
      toast.error('Erreur lors de la mise à jour du tarif');
    },
  });
}

export function useInitializeDeliveryCompanyFees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      deliveryCompany, 
      wilayas 
    }: { 
      deliveryCompany: string; 
      wilayas: { code: string; name: string }[];
    }) => {
      // Check if fees already exist for this company
      const { data: existing } = await supabase
        .from('delivery_company_fees')
        .select('wilaya_code')
        .eq('delivery_company', deliveryCompany);

      const existingCodes = new Set(existing?.map(e => e.wilaya_code) || []);
      
      // Only insert missing wilayas
      const toInsert = wilayas
        .filter(w => !existingCodes.has(w.code))
        .map(w => ({
          delivery_company: deliveryCompany,
          wilaya_code: w.code,
          wilaya_name: w.name,
          home_delivery_fee: 0,
          stop_desk_fee: 0,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('delivery_company_fees')
          .insert(toInsert);

        if (error) throw error;
      }

      return toInsert.length;
    },
    onSuccess: (count, { deliveryCompany }) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-company-fees', deliveryCompany] });
      if (count > 0) {
        toast.success(`${count} wilaya(s) initialisée(s)`);
      }
    },
    onError: (error) => {
      console.error('Error initializing delivery company fees:', error);
      toast.error('Erreur lors de l\'initialisation des tarifs');
    },
  });
}

export function useDeliveryCompanyFeeByWilaya(deliveryCompany: string | null, wilayaCode: string | null) {
  const { data: fees } = useDeliveryCompanyFees(deliveryCompany || '');
  
  if (!wilayaCode || !fees || !deliveryCompany) return null;
  
  // Extract code from "16 - Alger" format
  const code = wilayaCode.split(' - ')[0].trim();
  return fees.find(f => f.wilaya_code === code) || null;
}
