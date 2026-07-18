import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Charge } from '@/hooks/useCharges';

/**
 * Fetch order counts grouped by product / store for use with the
 * "per_order" charge frequency. We only count orders that have been
 * realized (delivered) since this matches the typical billing for
 * per-commande charges (COD fees, packaging, etc.).
 *
 * Returns a helper `getCountForCharge(charge)` that resolves the proper
 * count depending on the charge's product_id / store_id linkage:
 *  - product_id set → count distinct delivered orders containing that product
 *  - else store_id set → count delivered orders for that store
 *  - else → count all delivered orders in the period
 */

const DELIVERED_STATUSES = ['delivered', 'delivered_paid'] as const;

export interface ChargeOrderCounts {
  totalOrders: number;
  byStore: Map<string, number>;
  byProduct: Map<string, number>;
  getCountForCharge: (charge: Pick<Charge, 'product_id' | 'product_ids' | 'store_id' | 'charge_date' | 'charge_date_to' | 'frequency'>) => number;
}

export function useChargeOrderCounts(rangeFrom?: Date, rangeTo?: Date) {
  const fromIso = rangeFrom ? new Date(rangeFrom).toISOString() : undefined;
  const toIso = rangeTo ? new Date(rangeTo).toISOString() : undefined;

  return useQuery<ChargeOrderCounts>({
    queryKey: ['charge-order-counts', fromIso, toIso],
    queryFn: async () => {
      // 1) Fetch delivered orders in range
      let ordersQuery = supabase
        .from('orders')
        .select('id, store_id, created_at, delivered_at')
        .in('status', DELIVERED_STATUSES);
      if (fromIso) ordersQuery = ordersQuery.gte('created_at', fromIso);
      if (toIso) ordersQuery = ordersQuery.lte('created_at', toIso);

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      const orderIds = (orders || []).map(o => o.id);
      const totalOrders = orderIds.length;

      // 2) Aggregate by store
      const byStore = new Map<string, number>();
      for (const o of orders || []) {
        if (o.store_id) byStore.set(o.store_id, (byStore.get(o.store_id) || 0) + 1);
      }

      // 3) Fetch order_items for those orders → aggregate distinct order ids per product
      //    and total units (sum of quantity) per product / per store / overall.
      const byProduct = new Map<string, Set<string>>();
      const unitsByProduct = new Map<string, number>();
      const unitsByStore = new Map<string, number>();
      let totalUnits = 0;
      const storeByOrder = new Map<string, string | null>();
      for (const o of orders || []) storeByOrder.set(o.id, o.store_id ?? null);
      if (orderIds.length > 0) {
        // Chunk to avoid query size limits
        const chunkSize = 500;
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize);
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('order_id, product_id, quantity')
            .in('order_id', chunk);
          if (itemsError) throw itemsError;
          for (const it of items || []) {
            if (!it.product_id) continue;
            const set = byProduct.get(it.product_id) || new Set<string>();
            set.add(it.order_id);
            byProduct.set(it.product_id, set);
            const qty = Number(it.quantity) || 0;
            unitsByProduct.set(it.product_id, (unitsByProduct.get(it.product_id) || 0) + qty);
            totalUnits += qty;
            const sid = storeByOrder.get(it.order_id) || null;
            if (sid) unitsByStore.set(sid, (unitsByStore.get(sid) || 0) + qty);
          }
        }
      }

      const byProductCounts = new Map<string, number>();
      for (const [pid, set] of byProduct.entries()) byProductCounts.set(pid, set.size);

      const getCountForCharge: ChargeOrderCounts['getCountForCharge'] = (charge) => {
        const linkedProductIds = (charge.product_ids && charge.product_ids.length)
          ? charge.product_ids
          : (charge.product_id ? [charge.product_id] : []);
        if (charge.frequency === 'per_product') {
          if (linkedProductIds.length) {
            return linkedProductIds.reduce((sum, pid) => sum + (unitsByProduct.get(pid) || 0), 0);
          }
          if (charge.store_id) return unitsByStore.get(charge.store_id) || 0;
          return totalUnits;
        }
        if (linkedProductIds.length) {
          // Count distinct orders containing any of the linked products
          const ids = new Set<string>();
          for (const pid of linkedProductIds) {
            const set = byProduct.get(pid);
            if (set) for (const oid of set) ids.add(oid);
          }
          return ids.size;
        }
        if (charge.store_id) return byStore.get(charge.store_id) || 0;
        return totalOrders;
      };

      return { totalOrders, byStore, byProduct: byProductCounts, getCountForCharge };
    },
    staleTime: 60_000,
  });
}
