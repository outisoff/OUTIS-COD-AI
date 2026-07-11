import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversationNote {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
}

export function useConversationNotes(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation-notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('conversation_notes' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user names
      const notes = (data as unknown as ConversationNote[]) || [];
      const userIds = [...new Set(notes.map(n => n.user_id))];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profileMap = new Map(
          (profiles || []).map(p => [p.id, p.full_name || p.email || 'Inconnu'])
        );

        return notes.map(n => ({
          ...n,
          user_name: profileMap.get(n.user_id) || 'Inconnu',
        }));
      }

      return notes;
    },
    enabled: !!conversationId,
  });
}

export function useAddConversationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { conversation_id: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('conversation_notes' as any)
        .insert({
          conversation_id: params.conversation_id,
          user_id: user.id,
          content: params.content,
        } as any);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', vars.conversation_id] });
    },
  });
}

export function useDeleteConversationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; conversation_id: string }) => {
      const { error } = await supabase
        .from('conversation_notes' as any)
        .delete()
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', vars.conversation_id] });
    },
  });
}
