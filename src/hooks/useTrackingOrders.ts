import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import type { OrderWithItems } from './useOrders';

type OrderStatus = Database['public']['Enums']['order_status'];
const TRACKING_STATUSES: OrderStatus[] = ['at_station', 'en_livraison', 'au_bureau', 'alerte', 'delivered', 'Échec_de_livraison'];

export function useTrackingOrders(storeId?: string | null) {
  return useQuery({
    queryKey: ['orders-tracking', storeId],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products:product_id (sku)
          )
        `)
        .in('status', TRACKING_STATUSES)
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useTrackingDeliveries(orderIds: string[]) {
  return useQuery({
    queryKey: ['delivery-situations-tracking', orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return new Map();
      
      // Batch into chunks of 30 to avoid URL length limits
      const CHUNK_SIZE = 30;
      const allData: { order_id: string | null; delivery_status: string | null; delivery_situation: string | null; last_update: string | null }[] = [];

      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        const chunk = orderIds.slice(i, i + CHUNK_SIZE);
        const { data } = await supabase
          .from('deliveries')
          .select('order_id, delivery_status, delivery_situation, last_update')
          .in('order_id', chunk)
          .order('last_update', { ascending: false });
        if (data) allData.push(...data);
      }

      const map = new Map<string, { status: string | null; situation: string | null; last_update: string | null }>();
      allData.forEach(d => {
        if (d.order_id && !map.has(d.order_id)) {
          map.set(d.order_id, { status: d.delivery_status, situation: d.delivery_situation, last_update: d.last_update });
        }
      });
      return map;
    },
    enabled: orderIds.length > 0,
    staleTime: 60_000,
    refetchInterval: 60000,
  });
}
