import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ChargeSubcategory {
  id: string;
  category: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useChargeSubcategories() {
  return useQuery({
    queryKey: ['charge_subcategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_subcategories' as any)
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ChargeSubcategory[];
    },
  });
}

export function useAddChargeSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, name }: { category: string; name: string }) => {
      const { error } = await supabase
        .from('charge_subcategories' as any)
        .insert({ category, name } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charge_subcategories'] }),
  });
}

export function useDeleteChargeSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('charge_subcategories' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charge_subcategories'] }),
  });
}
