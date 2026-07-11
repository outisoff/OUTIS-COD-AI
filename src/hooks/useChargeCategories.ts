import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ChargeCategoryRow {
  id: string;
  value: string;
  label: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export function useChargeCategories() {
  return useQuery({
    queryKey: ['charge_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_categories' as any)
        .select('*')
        .order('label', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ChargeCategoryRow[];
    },
  });
}

export function useAddChargeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { value: string; label: string; color: string; icon: string }) => {
      const { error } = await supabase.from('charge_categories' as any).insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charge_categories'] }),
  });
}

export function useUpdateChargeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChargeCategoryRow> & { id: string }) => {
      const { error } = await supabase.from('charge_categories' as any).update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charge_categories'] }),
  });
}

export function useDeleteChargeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('charge_categories' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charge_categories'] }),
  });
}
