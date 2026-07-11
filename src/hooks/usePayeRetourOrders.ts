import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import type { OrderWithItems } from './useOrders';

type OrderStatus = Database['public']['Enums']['order_status'];

const PAYE_RETOUR_STATUSES: OrderStatus[] = [
  'delivered', 'delivered_paid', 'Échec_de_livraison', 'returned'
];

export function usePayeRetourOrders(storeId?: string | null) {
  return useQuery({
    queryKey: ['orders-paye-retour', storeId],
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
        .in('status', PAYE_RETOUR_STATUSES)
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
