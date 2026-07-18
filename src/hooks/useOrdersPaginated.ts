import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

export type PaginatedOrderWithItems = Order & {
  order_items: (OrderItem & { products: { sku: string } | null })[];
};

export interface OrdersFilters {
  search: string;
  status: string;
  agent: string;
  deliveryCompanies: string[];
  deliveryType: string;
  storeId: string;
}

export interface PaginatedOrdersResult {
  orders: PaginatedOrderWithItems[];
  totalCount: number;
  totalPages: number;
}

const PAGE_SIZE = 50;

export function useOrdersPaginated(
  page: number,
  filters: OrdersFilters
) {
  return useQuery({
    queryKey: ['orders-paginated', page, filters],
    queryFn: async (): Promise<PaginatedOrdersResult> => {
      // --- Build count query ---
      let countQuery = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true });

      countQuery = applyFilters(countQuery, filters);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalCount = count || 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

      if (totalCount === 0) {
        return { orders: [], totalCount: 0, totalPages: 1 };
      }

      // --- Build data query ---
      let dataQuery = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products:product_id (sku)
          )
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      dataQuery = applyFilters(dataQuery, filters);

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        orders: (data || []) as PaginatedOrderWithItems[],
        totalCount,
        totalPages,
      };
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // keep previous data while loading
  });
}

function applyFilters<T extends { eq: any; ilike: any; or: any; in: any; is: any }>(
  query: T,
  filters: OrdersFilters
): T {
  // Status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  // Agent filter
  if (filters.agent && filters.agent !== 'all') {
    if (filters.agent === 'unassigned') {
      query = query.is('assigned_agent', null);
    } else {
      query = query.eq('assigned_agent', filters.agent);
    }
  }

  // Delivery type filter
  if (filters.deliveryType && filters.deliveryType !== 'all') {
    query = query.eq('delivery_type', filters.deliveryType);
  }

  // Delivery company filter (OR across selected companies using ilike)
  if (filters.deliveryCompanies.length > 0) {
    const orParts = filters.deliveryCompanies
      .map(c => `delivery_company.ilike.%${c}%`)
      .join(',');
    query = query.or(orParts);
  }

  // Search filter
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    // Escape PostgREST OR special chars in search term
    const safe = term.replace(/[,()*]/g, '');
    const orParts = [
      `order_number.ilike.%${safe}%`,
      `customer_name.ilike.%${safe}%`,
      `customer_phone.ilike.%${safe}%`,
    ];
    // If the search looks like a phone number, also match by normalized digits
    // so "0663819127" finds "+213663819127", "213663819127", etc.
    if (/\d/.test(safe)) {
      const digits = safe.replace(/\D/g, '');
      let normalized = digits;
      if (normalized.startsWith('00213')) normalized = normalized.slice(5);
      else if (normalized.startsWith('213')) normalized = normalized.slice(3);
      else if (normalized.startsWith('0')) normalized = normalized.slice(1);
      if (normalized && normalized !== safe) {
        orParts.push(`customer_phone.ilike.%${normalized}%`);
      }
    }
    query = query.or(orParts.join(','));
  }

  // Store filter
  if (filters.storeId && filters.storeId !== 'all') {
    if (filters.storeId === 'none') {
      query = query.is('store_id', null);
    } else {
      query = query.eq('store_id', filters.storeId);
    }
  }

  return query;
}

export { PAGE_SIZE };
