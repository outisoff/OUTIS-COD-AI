import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import type { OrderWithItems } from './useOrders';

type OrderStatus = Database['public']['Enums']['order_status'];

const ECHANGE_STATUSES: OrderStatus[] = ['exchange'];

/**
 * Fetches exchange orders + eligible orders for the Échange/Remboursement page.
 * Two queries: exchange-status orders and all non-terminal for the "add" dialog.
 */
export function useEchangeOrders(storeId?: string | null) {
  return useQuery({
    queryKey: ['orders-echange', storeId],
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
        .in('status', ECHANGE_STATUSES)
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

/** Fetches orders that have been swapped via ZR Express (from order_history) */
export function useSwappedOrders(storeId?: string | null) {
  return useQuery({
    queryKey: ['orders-swapped-v2', storeId],
    queryFn: async () => {
      const { data: history, error: hErr } = await supabase
        .from('order_history')
        .select('order_id, notes, created_at')
        .eq('changed_by', 'ZR Express Swap')
        .order('created_at', { ascending: false });
      if (hErr) throw hErr;

      // Keep only orders whose MOST RECENT swap-related event is a "Swap manuel ←" (receive).
      // Orders whose latest event is "Swap annulé" (revert) are excluded so reverted swaps disappear.
      const latestByOrder = new Map<string, string | null>();
      for (const h of history ?? []) {
        if (!h.order_id) continue;
        if (!latestByOrder.has(h.order_id)) latestByOrder.set(h.order_id, h.notes);
      }
      const orderIds = [...latestByOrder.entries()]
        .filter(([, notes]) => (notes ?? '').startsWith('Swap manuel ←'))
        .map(([id]) => id);
      if (orderIds.length === 0) return [] as OrderWithItems[];


      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products:product_id (sku)
          )
        `)
        .in('id', orderIds)
        .order('updated_at', { ascending: false });

      if (storeId) query = query.eq('store_id', storeId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetches orders eligible for a ZR Express API swap:
 * - delivery_company = 'ZR Express' with tracking_number
 * - status = 'failed_delivery' (Échec_de_livraison) — parcel still at ZR, not yet returned
 * - deliveries.delivery_situation IN ('Ne réponds pas 3', 'Commande annulée')
 */
export function useSwapEligibleOrders(storeId?: string | null) {
  return useQuery({
    queryKey: ['orders-swap-eligible-v6', storeId],
    queryFn: async () => {
      const eligibleSituations = ['Ne réponds pas 3', 'Commande annulée'];
      // ZR platform only allows swap within the last 48h after the failed-delivery situation
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data: dels, error: dErr } = await supabase
        .from('deliveries')
        .select('order_id, delivery_situation, last_update')
        .in('delivery_situation', eligibleSituations)
        .gte('last_update', since);
      if (dErr) throw dErr;

      const orderIds = [...new Set((dels ?? []).map(d => d.order_id).filter(Boolean))] as string[];
      if (orderIds.length === 0) return [] as OrderWithItems[];

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products:product_id (sku)
          )
        `)
        .in('id', orderIds)
        .eq('delivery_company', 'ZR Express')
        .eq('status', 'Échec_de_livraison' as OrderStatus)
        .not('tracking_number', 'is', null)
        .order('updated_at', { ascending: false });

      if (storeId) query = query.eq('store_id', storeId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Lightweight search for eligible orders in the "add exchange" dialog */
export function useEligibleOrderSearch(search: string, storeId?: string | null, mode: 'echange' | 'swap' = 'echange') {
  return useQuery({
    queryKey: ['orders-echange-eligible', search, storeId, mode],
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
        .order('created_at', { ascending: false })
        .limit(20);

      if (mode === 'swap') {
        // Swap source: ZR Express order with tracking. When the user searches, allow any status so
        // they can find a parcel by tracking number even if it's not in the eligible list yet.
        query = query
          .eq('delivery_company', 'ZR Express')
          .not('tracking_number', 'is', null);
        if (!search.trim()) {
          const swapStatuses: OrderStatus[] = ['failed_3', 'cancelled'];
          query = query.in('status', swapStatuses);
        }
      } else {
        const excludeStatuses: OrderStatus[] = ['exchange', 'returned', 'cancelled', 'new'];
        query = query.not('status', 'in', `(${excludeStatuses.join(',')})`);
      }


      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (search.trim()) {
        const safe = search.trim().replace(/[,()*]/g, '');
        query = query.or(
          `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%,tracking_number.ilike.%${safe}%`
        );
      }


      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Search for confirmed orders eligible to RECEIVE a swapped tracking (target). */
export function useSwapTargetSearch(search: string, storeId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['orders-swap-targets', search, storeId],
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
        .eq('status', 'confirmed' as OrderStatus)
        .is('tracking_number', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (storeId) query = query.eq('store_id', storeId);

      if (search.trim()) {
        const safe = search.trim().replace(/[,()*]/g, '');
        query = query.or(
          `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    enabled,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Global search across ALL orders by tracking number / order number / phone / name. */
export function useGlobalOrderSearch(search: string, storeId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['orders-global-search', search, storeId],
    queryFn: async () => {
      const safe = search.trim().replace(/[,()*]/g, '');
      if (!safe) return [] as OrderWithItems[];

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products:product_id (sku)
          )
        `)
        .or(
          `tracking_number.ilike.%${safe}%,order_number.ilike.%${safe}%,customer_phone.ilike.%${safe}%,customer_name.ilike.%${safe}%`
        )
        .order('created_at', { ascending: false })
        .limit(30);

      if (storeId) query = query.eq('store_id', storeId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    enabled: enabled && search.trim().length >= 2,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}


