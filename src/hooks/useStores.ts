import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type StoreUpdate = Database['public']['Tables']['stores']['Update'];

export interface Store {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, is_active, created_at, updated_at')
        .order('name');
      if (error) throw error;
      return data as Store[];
    },
  });
}

export function useActiveStores() {
  return useQuery({
    queryKey: ['stores', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Store[];
    },
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('stores')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Store ajouté');
    },
    onError: (error: any) => {
      if (error?.message?.includes('duplicate')) {
        toast.error('Ce nom de store existe déjà');
      } else {
        toast.error("Erreur lors de l'ajout du store");
      }
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, is_active }: { id: string; name?: string; is_active?: boolean }) => {
      const updates: StoreUpdate = {};
      if (name !== undefined) updates.name = name;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Store mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Store supprimé');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });
}
