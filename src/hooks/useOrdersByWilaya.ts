import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

export type MapFilterStatus = 'total' | 'received' | 'confirmed' | 'delivered' | 'cancelled' | 'returned';

const STATUS_MAP: Record<MapFilterStatus, OrderStatus[]> = {
  total: [],
  received: [],
  confirmed: ['confirmed'],
  delivered: ['delivered', 'delivered_paid'],
  cancelled: ['cancelled'],
  returned: ['returned', 'Échec_de_livraison'],
};

export function useOrdersByWilaya(dateFrom?: Date, dateTo?: Date, filterStatus: MapFilterStatus = 'total', filteredOrderIds?: string[] | null, storeId?: string | null, dateField: 'created_at' | 'updated_at' = 'created_at') {
  return useQuery({
    queryKey: ['orders-by-wilaya', dateFrom?.toISOString(), dateTo?.toISOString(), filterStatus, filteredOrderIds, storeId, dateField],
    queryFn: async () => {
      const hasProductFilter = Array.isArray(filteredOrderIds);
      if (hasProductFilter && filteredOrderIds.length === 0) return {};

      const startDay = dateFrom ? new Date(dateFrom) : new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = dateTo ? new Date(dateTo) : new Date(startDay);
      endDay.setHours(23, 59, 59, 999);

      const pageSize = 1000;
      const fetchAll = async (
        dateColumn: 'created_at' | 'updated_at',
        statuses: OrderStatus[]
      ) => {
        const effectiveCol = dateField === 'updated_at' ? 'updated_at' : dateColumn;
        const rows: { id: string; wilaya: string }[] = [];
        let page = 0;
        while (true) {
          let q = supabase
            .from('orders')
            .select('id, wilaya')
            .gte(effectiveCol, startDay.toISOString())
            .lte(effectiveCol, endDay.toISOString())
            .neq('status', 'duplicate')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (storeId) q = q.eq('store_id', storeId);
          if (statuses.length > 0) q = q.in('status', statuses);
          if (hasProductFilter && filteredOrderIds.length > 0) q = q.in('id', filteredOrderIds);
          const { data, error } = await q;
          if (error) throw error;
          if (data) rows.push(...data);
          if (!data || data.length < pageSize) break;
          page++;
        }
        return rows;
      };

      let merged: { id: string; wilaya: string }[] = [];

      if (filterStatus === 'total') {
        // Total = Reçues (created_at, any status) ∪ Annulées ∪ Livré ∪ Retour (updated_at)
        const [received, cancelled, delivered, returned] = await Promise.all([
          fetchAll('created_at', []),
          fetchAll('updated_at', STATUS_MAP.cancelled),
          fetchAll('updated_at', STATUS_MAP.delivered),
          fetchAll('updated_at', STATUS_MAP.returned),
        ]);
        const seen = new Set<string>();
        for (const r of [...received, ...cancelled, ...delivered, ...returned]) {
          if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
        }
      } else {
        const dateColumn: 'created_at' | 'updated_at' =
          filterStatus === 'received' ? 'created_at' : 'updated_at';
        merged = await fetchAll(dateColumn, STATUS_MAP[filterStatus]);
      }


      const counts: Record<string, number> = {};
      merged.forEach(o => {
        counts[o.wilaya] = (counts[o.wilaya] || 0) + 1;
      });
      return counts;
    },
  });
}
