import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface MetaConversation {
  id: string;
  platform: string;
  conversation_type: string;
  sender_id: string;
  sender_name: string | null;
  sender_profile_pic: string | null;
  page_id: string;
  post_id: string | null;
  thread_id: string | null;
  last_message_at: string;
  is_read: boolean;
  created_at: string;
}

export interface MetaMessage {
  id: string;
  conversation_id: string;
  meta_message_id: string | null;
  direction: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  is_comment: boolean;
  parent_comment_id: string | null;
  created_at: string;
}

export function useMetaConversations(platformFilter?: string) {
  return useQuery({
    queryKey: ['meta-conversations', platformFilter],
    queryFn: async () => {
      let query = supabase
        .from('meta_conversations' as any)
        .select('*')
        .order('last_message_at', { ascending: false });

      if (platformFilter && platformFilter !== 'all') {
        query = query.eq('platform', platformFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as MetaConversation[]) || [];
    },
    refetchInterval: 5000,
  });
}

export function useMetaConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['meta-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('meta_messages' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as unknown as MetaMessage[]) || [];
    },
    enabled: !!conversationId,
    refetchInterval: 3000,
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('meta_conversations' as any)
        .update({ is_read: true } as any)
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-conversations'] });
    },
  });
}

export function useSendMetaReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversation_id: string;
      message: string;
      reply_to_comment_id?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('meta-reply', {
        body: params,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['meta-messages', vars.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['meta-conversations'] });
    },
  });
}

export function useMetaConversationsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('meta-inbox-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meta_conversations',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['meta-conversations'] });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'meta_messages',
      }, (payload: any) => {
        const convId = payload.new?.conversation_id;
        if (convId) {
          queryClient.invalidateQueries({ queryKey: ['meta-messages', convId] });
        }
        queryClient.invalidateQueries({ queryKey: ['meta-conversations'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
