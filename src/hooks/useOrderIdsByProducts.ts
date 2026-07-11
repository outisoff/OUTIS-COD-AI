import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetches all order IDs that contain at least one of the given product IDs.
 * Returns null when no filter is active (empty productIds array).
 */
export function useOrderIdsByProducts(productIds: string[]) {
  return useQuery({
    queryKey: ['order-ids-by-products', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return null;

      let allItems: { order_id: string }[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('order_items')
          .select('order_id')
          .in('product_id', productIds)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data) allItems = allItems.concat(data);
        if (!data || data.length < pageSize) break;
        page++;
      }

      return [...new Set(allItems.map(i => i.order_id))];
    },
    enabled: productIds.length > 0,
  });
}
