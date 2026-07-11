import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AssignmentRule {
  id: string;
  rule_type: 'source' | 'product' | 'date_period' | 'schedule';
  agent_name: string;
  match_value: string;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_hour: number | null;
  end_hour: number | null;
  created_at: string;
  updated_at: string;
}

export type AssignmentMode = 'round_robin' | 'workload' | 'rules' | 'combined';

export function useAssignmentRules() {
  return useQuery({
    queryKey: ['assignment-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_rules')
        .select('*')
        .order('priority', { ascending: true });
      if (error) throw error;
      return data as AssignmentRule[];
    },
  });
}

export function useAssignmentSettings() {
  return useQuery({
    queryKey: ['assignment-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_settings')
        .select('*');
      if (error) throw error;
      const settings: Record<string, any> = {};
      data?.forEach((s: any) => {
        let val = s.setting_value;
        // Unwrap JSON-stringified values (e.g. "\"workload\"" -> "workload")
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch {}
        }
        settings[s.setting_key] = val;
      });
      return settings;
    },
  });
}

export function useAddAssignmentRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { rule_type: string; agent_name: string; match_value: string; priority?: number; start_date?: string; end_date?: string; days_of_week?: number[]; start_hour?: number; end_hour?: number }) => {
      const { error } = await supabase
        .from('assignment_rules')
        .insert(rule);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
      toast.success('Règle ajoutée');
    },
    onError: () => toast.error('Erreur lors de l\'ajout de la règle'),
  });
}

export function useDeleteAssignmentRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assignment_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
      toast.success('Règle supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });
}

export function useUpdateAssignmentMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mode: AssignmentMode) => {
      const { error } = await supabase
        .from('assignment_settings')
        .upsert({ setting_key: 'mode', setting_value: JSON.stringify(mode) }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-settings'] });
      toast.success('Mode mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useToggleAutoAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('assignment_settings')
        .upsert({ setting_key: 'auto_enabled', setting_value: JSON.stringify(enabled) }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-settings'] });
      toast.success('Paramètre mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useUpdateWorkingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ startHour, endHour }: { startHour: number; endHour: number }) => {
      const { error } = await supabase
        .from('assignment_settings')
        .upsert({ setting_key: 'working_hours', setting_value: JSON.stringify({ start: startHour, end: endHour }) }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-settings'] });
      toast.success('Horaires mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useToggleNoWhatsappAssign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('assignment_settings')
        .upsert({ setting_key: 'no_whatsapp_instant_assign', setting_value: JSON.stringify(enabled) }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-settings'] });
      toast.success('Paramètre mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useToggleInstantAssignNoAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('assignment_settings')
        .upsert({ setting_key: 'instant_assign_no_ai', setting_value: JSON.stringify(enabled) }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-settings'] });
      toast.success('Paramètre mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useUpdateStaleDelay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (minutes: number) => {
      const { error } = await supabase
        .from('assignment_settings')
        .upsert({ setting_key: 'stale_delay', setting_value: JSON.stringify(minutes) }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-settings'] });
      toast.success('Délai mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}
