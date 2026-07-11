import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { customerInsertSchema, customerUpdateSchema } from '@/lib/validation';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const allData: Customer[] = [];
      const pageSize = 1000;
      let from = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...(data as Customer[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      return allData;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCustomerByPhone(phone: string) {
  return useQuery({
    queryKey: ['customers', 'phone', phone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: phone.length >= 10,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customer: CustomerInsert) => {
      // Validate input before database insertion
      const validated = customerInsertSchema.parse(customer);
      
      const { data, error } = await supabase
        .from('customers')
        .insert(validated as CustomerInsert)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      // Validate input before database update
      const validated = customerUpdateSchema.parse({ id, ...customer });
      const { id: validatedId, ...updateData } = validated;
      
      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', validatedId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
