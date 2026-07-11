import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import type { OrderWithItems } from './useOrders';

type OrderStatus = Database['public']['Enums']['order_status'];

const CONFIRMATION_STATUSES: OrderStatus[] = [
  'new', 'validated', 'confirmed', 'cancelled', 'failed_1', 'failed_2', 'failed_3',
  'failed_4', 'failed_5', 'failed_6', 'no_answer', 'wrong_number', 'postponed',
  'to_reconfirm', 'callback', 'duplicate', 'out_of_stock', 'erreur'
];

// All "Annulé" statuses auto-hide from Confirmation after 24h
const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'];

export function useConfirmationOrders(storeId?: string | null) {
  return useQuery({
    queryKey: ['orders-confirmation', storeId],
    queryFn: async () => {
      // Fetch orders + their latest status change from order_history
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products:product_id (sku)
          ),
          order_history (
            created_at,
            new_status
          )
        `)
        .in('status', CONFIRMATION_STATUSES)
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Filter out terminal statuses where the status was set more than 24h ago
      return ((data ?? []) as (OrderWithItems & { order_history?: { created_at: string; new_status: string }[] })[]).filter(order => {
        if (TERMINAL_STATUSES.includes(order.status as OrderStatus)) {
          // Find the most recent history entry matching current status
          const historyEntries = order.order_history || [];
          const statusEntry = historyEntries
            .filter(h => h.new_status === order.status)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          
          // Fallback to created_at (NOT updated_at — updated_at bumps on any field change, e.g. notes edits)
          const statusChangedAt = statusEntry ? new Date(statusEntry.created_at) : new Date(order.created_at);
          return statusChangedAt > twentyFourHoursAgo;
        }
        return true;
      });
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
