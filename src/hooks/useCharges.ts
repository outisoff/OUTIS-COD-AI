import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ChargeType = 'fixe' | 'recurrente';
export type ChargeFrequency = 'one_time' | 'weekly' | 'monthly' | 'yearly' | 'per_order' | 'per_product';

export interface Charge {
  id: string;
  name: string;
  amount: number;
  category: string;
  subcategory: string | null;
  charge_date: string;
  charge_date_to: string | null;
  is_recurring: boolean;
  charge_type: ChargeType;
  frequency: ChargeFrequency;
  notes: string | null;
  store_id: string | null;
  product_id: string | null;
  product_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useCharges(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['charges', dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase.from('charges' as any).select('*').order('charge_date', { ascending: false });
      // A charge is "active" in [dateFrom, dateTo] if it started on/before dateTo
      // AND its end (charge_date_to, if set) is on/after dateFrom. Recurring
      // charges started before the range are still active inside the range.
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('charge_date', end.toISOString().split('T')[0]);
      }
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        const startStr = start.toISOString().split('T')[0];
        query = query.or(`charge_date_to.is.null,charge_date_to.gte.${startStr}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Charge[];
    },
  });
}

export function useAddCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (charge: Omit<Charge, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('charges' as any).insert(charge as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charges'] }),
  });
}

export function useUpdateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Charge> & { id: string }) => {
      const { error } = await supabase.from('charges' as any).update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charges'] }),
  });
}

export function useDeleteCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('charges' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charges'] }),
  });
}
