import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MetaIntegration {
  id: string;
  page_id: string | null;
  app_id: string | null;
  app_secret_encrypted: string | null;
  page_access_token_encrypted: string | null;
  verify_token: string;
  is_connected: boolean;
  instagram_connected: boolean;
  facebook_connected: boolean;
  auto_reply_comments: boolean;
  auto_reply_messages: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaPage {
  id: string;
  integration_id: string | null;
  platform: 'facebook' | 'instagram' | 'tiktok';
  page_name: string;
  page_id: string;
  page_access_token_encrypted: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useMetaIntegration() {
  return useQuery({
    queryKey: ['meta-integration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_integration' as any)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as unknown as MetaIntegration | null;
    },
  });
}

export function useMetaPages() {
  return useQuery({
    queryKey: ['meta-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_pages' as any)
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as unknown as MetaPage[]) || [];
    },
  });
}

export function useSaveMetaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      app_id: string;
      app_secret: string;
      page_access_token: string;
      page_id?: string;
      instagram_id?: string;
      connect_instagram?: boolean;
    }) => {
      const { data: existing } = await supabase
        .from('meta_integration' as any)
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('meta_integration' as any)
          .update({
            app_id: values.app_id,
            app_secret_encrypted: values.app_secret,
            page_access_token_encrypted: values.page_access_token,
            page_id: values.page_id || null,
            is_connected: true,
            facebook_connected: true,
            instagram_connected: values.connect_instagram ?? false,
          } as any)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('meta_integration' as any)
          .insert({
            app_id: values.app_id,
            app_secret_encrypted: values.app_secret,
            page_access_token_encrypted: values.page_access_token,
            page_id: values.page_id || null,
            is_connected: true,
            facebook_connected: true,
            instagram_connected: values.connect_instagram ?? false,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      toast.success('Intégration Meta sauvegardée');
    },
    onError: (error) => {
      console.error('Error saving Meta integration:', error);
      toast.error('Erreur lors de la sauvegarde');
    },
  });
}

export function useAddMetaPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      integration_id?: string;
      platform: 'facebook' | 'instagram' | 'tiktok';
      page_name: string;
      page_id: string;
      page_access_token?: string;
    }) => {
      const { error } = await supabase
        .from('meta_pages' as any)
        .insert({
          integration_id: values.integration_id || null,
          platform: values.platform,
          page_name: values.page_name,
          page_id: values.page_id,
          page_access_token_encrypted: values.page_access_token || null,
          is_active: true,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-pages'] });
      toast.success('Page ajoutée');
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de la page");
    },
  });
}

export function useToggleMetaPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('meta_pages' as any)
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-pages'] });
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });
}

export function useDeleteMetaPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_pages' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-pages'] });
      toast.success('Page supprimée');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });
}

export function useUpdateMetaSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('meta_integration' as any)
        .update(values as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      toast.success('Paramètres mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });
}

export function useDisconnectMeta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_integration' as any)
        .update({
          is_connected: false,
          facebook_connected: false,
          instagram_connected: false,
          app_id: null,
          app_secret_encrypted: null,
          page_access_token_encrypted: null,
          page_id: null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      toast.success('Meta déconnecté');
    },
    onError: () => {
      toast.error('Erreur lors de la déconnexion');
    },
  });
}
