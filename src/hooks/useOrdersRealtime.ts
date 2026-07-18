import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useOrdersRealtime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const debounceOrdersRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceDeliveriesRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Unique channel name per mount to avoid collisions across tabs/instances
    const channelName = `orders-realtime-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const oldRow = (payload.old as any) || {};
            const newRow = (payload.new as any) || {};

            // Only show "Nouvelle remarque" if notes field is actually present in old payload
            // and changed by becoming longer (real append). Avoids false positives when
            // payload.old does not include unchanged columns (REPLICA IDENTITY DEFAULT).
            const hasOldNotes = Object.prototype.hasOwnProperty.call(oldRow, 'notes');
            const oldNotes = oldRow.notes ?? '';
            const newNotes = newRow.notes ?? '';

            if (
              hasOldNotes &&
              newNotes !== oldNotes &&
              typeof newNotes === 'string' &&
              typeof oldNotes === 'string' &&
              newNotes.length > oldNotes.length
            ) {
              const orderNumber = newRow.order_number;
              toast({
                title: '💬 Nouvelle remarque',
                description: `Remarque ajoutée sur ${orderNumber || 'une commande'}`,
              });
            }

            const oldStatus = oldRow.status;
            const newStatus = newRow.status;
            if (oldStatus && newStatus && oldStatus !== newStatus) {
              const orderNumber = newRow.order_number;
              toast({
                title: '📦 Statut mis à jour',
                description: `${orderNumber || 'Commande'}: ${newStatus}`,
              });
            }
          }
          
          // Reduced debounce for faster UI updates
          if (debounceOrdersRef.current) {
            clearTimeout(debounceOrdersRef.current);
          }
          debounceOrdersRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-paginated'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-tracking'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-confirmation'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-expedition'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-paye-retour'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-echange'], refetchType: 'active' });
          }, 150);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
        },
        () => {
          if (debounceDeliveriesRef.current) {
            clearTimeout(debounceDeliveriesRef.current);
          }
          debounceDeliveriesRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-paginated'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-tracking'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-confirmation'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-expedition'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-paye-retour'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders-echange'], refetchType: 'active' });
          }, 150);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_confirmation_logs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'], refetchType: 'active' });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[orders-realtime] subscription status:', status);
        }
      });

    return () => {
      if (debounceOrdersRef.current) clearTimeout(debounceOrdersRef.current);
      if (debounceDeliveriesRef.current) clearTimeout(debounceDeliveriesRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);
}
