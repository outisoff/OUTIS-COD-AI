import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Integration {
  id: string;
  integration_type: string;
  name: string;
  api_key: string | null;
  api_secret: string | null;
  webhook_url: string | null;
  spreadsheet_id: string | null;
  store_url: string | null;
  is_enabled: boolean;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type IntegrationType = 'delivery' | 'google_sheets' | 'ecommerce';

export interface IntegrationInput {
  integration_type: string;
  name: string;
  api_key?: string | null;
  api_secret?: string | null;
  webhook_url?: string | null;
  spreadsheet_id?: string | null;
  store_url?: string | null;
  is_enabled?: boolean;
  settings?: Record<string, unknown> | null;
}

export const DELIVERY_COMPANIES = ['RJ360', 'ZR Express', 'Maystro'] as const;
export const ECOMMERCE_PLATFORMS = ['Shopify', 'LightFunnel'] as const;

export function useIntegrations(type?: IntegrationType) {
  return useQuery({
    queryKey: ['integrations', type],
    queryFn: async () => {
      let query = supabase
        .from('integrations')
        .select('*')
        .order('name');
      
      if (type) {
        query = query.eq('integration_type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching integrations:', error);
        throw error;
      }
      
      return data as Integration[];
    },
  });
}

export function useUpsertIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integration: IntegrationInput) => {
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('integration_type', integration.integration_type)
        .eq('name', integration.name)
        .maybeSingle();

      if (existing) {
        const updateData: Record<string, unknown> = {};
        if (integration.api_key !== undefined) updateData.api_key = integration.api_key;
        if (integration.api_secret !== undefined) updateData.api_secret = integration.api_secret;
        if (integration.webhook_url !== undefined) updateData.webhook_url = integration.webhook_url;
        if (integration.spreadsheet_id !== undefined) updateData.spreadsheet_id = integration.spreadsheet_id;
        if (integration.store_url !== undefined) updateData.store_url = integration.store_url;
        if (integration.is_enabled !== undefined) updateData.is_enabled = integration.is_enabled;
        if (integration.settings !== undefined) updateData.settings = integration.settings;

        const { error } = await supabase
          .from('integrations')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integrations')
          .insert({
            integration_type: integration.integration_type,
            name: integration.name,
            api_key: integration.api_key ?? null,
            api_secret: integration.api_secret ?? null,
            webhook_url: integration.webhook_url ?? null,
            spreadsheet_id: integration.spreadsheet_id ?? null,
            store_url: integration.store_url ?? null,
            is_enabled: integration.is_enabled ?? false,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Intégration enregistrée avec succès');
    },
    onError: (error) => {
      console.error('Error saving integration:', error);
      toast.error("Erreur lors de l'enregistrement de l'intégration");
    },
  });
}

export function useToggleIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('integrations')
        .update({ is_enabled })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error) => {
      console.error('Error toggling integration:', error);
      toast.error("Erreur lors de la modification de l'intégration");
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Intégration supprimée');
    },
    onError: (error) => {
      console.error('Error deleting integration:', error);
      toast.error("Erreur lors de la suppression de l'intégration");
    },
  });
}
