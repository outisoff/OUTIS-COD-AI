import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import type { DashboardFiltersState } from '@/components/dashboard/DashboardFilters';

type OrderSource = Database['public']['Enums']['order_source'];

/**
 * Fetches order IDs matching the active dashboard filters.
 * Returns undefined when no filters are active.
 * Returns string[] when filters are active (may be empty if no matches).
 */
export function useFilteredOrderIds(filters: DashboardFiltersState) {
  const hasAnyFilter = Object.values(filters).some(arr => arr.length > 0);

  return useQuery({
    queryKey: ['dashboard-filtered-order-ids', filters],
    queryFn: async (): Promise<string[] | null> => {
      if (!hasAnyFilter) return null;

      // Step 1: If product or category filters, get product IDs
      let targetProductIds: string[] | null = null;
      
      if (filters.productIds.length > 0 || filters.categories.length > 0) {
        let productIds = [...filters.productIds];
        
        if (filters.categories.length > 0) {
          const { data: catProducts, error } = await supabase
            .from('products')
            .select('id')
            .in('category', filters.categories);
          if (error) throw error;
          const catProductIds = (catProducts || []).map(p => p.id);
          
          if (filters.productIds.length > 0) {
            // Intersect: must match both product AND category
            productIds = productIds.filter(id => catProductIds.includes(id));
          } else {
            productIds = catProductIds;
          }
        }
        
        if (productIds.length === 0) return [];
        
        // Get order IDs containing these products
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
        targetProductIds = [...new Set(allItems.map(i => i.order_id))];
        if (targetProductIds.length === 0) return [];
      }

      // Step 2: Query orders with remaining filters
      const hasOrderFilter = filters.wilayas.length > 0 || filters.agents.length > 0 || 
                             filters.deliveryCompanies.length > 0 || filters.sources.length > 0;

      if (!hasOrderFilter && targetProductIds !== null) {
        return targetProductIds;
      }

      if (!hasOrderFilter && targetProductIds === null) {
        return null;
      }

      // Fetch order IDs with order-level filters
      let allOrderIds: string[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabase
          .from('orders')
          .select('id')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (filters.wilayas.length > 0) {
          query = query.in('wilaya', filters.wilayas);
        }
        if (filters.agents.length > 0) {
          query = query.in('assigned_agent', filters.agents);
        }
        if (filters.deliveryCompanies.length > 0) {
          query = query.in('delivery_company', filters.deliveryCompanies);
        }
        if (filters.sources.length > 0) {
          query = query.in('source', filters.sources as OrderSource[]);
        }
        if (targetProductIds !== null) {
          query = query.in('id', targetProductIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) allOrderIds = allOrderIds.concat(data.map(o => o.id));
        if (!data || data.length < pageSize) break;
        page++;
      }

      return allOrderIds;
    },
    enabled: hasAnyFilter,
  });
}
