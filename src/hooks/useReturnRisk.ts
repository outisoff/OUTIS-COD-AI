import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type RiskLevel = 'nouveau' | 'faible' | 'moyen' | 'élevé';

interface CustomerRiskData {
  phone: string;
  totalOrders: number;
  returnedOrders: number;
  riskLevel: RiskLevel;
  returnRate: number;
  deliveryFailures: number;
  deliveredOrders: number;
  returnedCount: number;
  inConfirmation: number;
  inPreparation: number;
  inDelivery: number;
  cancelledOrders: number;
  activeOrderIds: string[];
}

// Local order statuses indicating returns/failures
const RETURN_STATUSES: string[] = [];

// RJ360/delivery statuses indicating delivery problems
const DELIVERY_FAILURE_STATUSES = [
  'retour', 'retourné', 'returned', 'echec', 'échoué', 
  'échec_de_livraison', 'failed', 'annulé', 'cancelled',
  'erreur', 'error', 'refusé', 'refused'
];

function isDeliveryFailure(status: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  return DELIVERY_FAILURE_STATUSES.some(s => normalized.includes(s));
}

function normalizePhoneForRisk(phone: string | null | undefined): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');

  // +213XXXXXXXXX or 213XXXXXXXXX -> 0XXXXXXXXX
  if (digits.startsWith('213') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  // 00213XXXXXXXXX -> 0XXXXXXXXX
  if (digits.startsWith('00213') && digits.length === 14) {
    return `0${digits.slice(5)}`;
  }

  // 9-digit mobile without leading 0 -> prefix with 0
  if (digits.length === 9 && /^[567]/.test(digits)) {
    return `0${digits}`;
  }

  return digits;
}

export function useReturnRiskData() {
  // Fetch orders with phone & status
  const { data: orders } = useQuery({
    queryKey: ['orders-return-risk'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_phone, status');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch delivery data (RJ360 / ZR Express statuses)
  const { data: deliveries } = useQuery({
    queryKey: ['deliveries-return-risk'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('order_id, delivery_status');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000,
  });

  const riskMap = useMemo(() => {
    const map = new Map<string, CustomerRiskData>();
    if (!orders) return map;

    // Index deliveries by order_id
    const deliveryByOrderId = new Map<string, { delivery_status: string | null }>();
    if (deliveries) {
      for (const d of deliveries) {
        if (d.order_id) {
          deliveryByOrderId.set(d.order_id, d);
        }
      }
    }

    const ACTIVE_STATUSES = ['new', 'validated', 'confirmed', 'preparing', 'ready', 'shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'exchange', 'alerte', 'to_reconfirm', 'callback', 'postponed', 'failed_1', 'failed_2', 'failed_3', 'erreur'];

    const CONFIRMATION_STATUSES = ['new', 'validated', 'confirmed', 'callback', 'postponed', 'to_reconfirm', 'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6', 'erreur'];
    const PREPARATION_STATUSES = ['preparing', 'ready'];
    const IN_DELIVERY_STATUSES = ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'alerte'];

    const CANCELLED_STATUSES = ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'];

    const grouped = new Map<string, { total: number; returned: number; returnedOnly: number; deliveryFailures: number; delivered: number; inConfirmation: number; inPreparation: number; inDelivery: number; cancelled: number; activeOrderIds: string[] }>();
    const rawToNormalizedPhone = new Map<string, string>();

    for (const order of orders) {
      const rawPhone = order.customer_phone;
      const normalizedPhone = normalizePhoneForRisk(rawPhone);

      if (!normalizedPhone) continue;

      rawToNormalizedPhone.set(rawPhone, normalizedPhone);

      if (!grouped.has(normalizedPhone)) {
        grouped.set(normalizedPhone, { total: 0, returned: 0, returnedOnly: 0, deliveryFailures: 0, delivered: 0, inConfirmation: 0, inPreparation: 0, inDelivery: 0, cancelled: 0, activeOrderIds: [] });
      }

      const stats = grouped.get(normalizedPhone)!;
      stats.total++;

      if (ACTIVE_STATUSES.includes(order.status)) {
        stats.activeOrderIds.push(order.id);
      }

      if (['delivered', 'delivered_paid'].includes(order.status)) {
        stats.delivered++;
      }

      if (CONFIRMATION_STATUSES.includes(order.status)) {
        stats.inConfirmation++;
      }

      if (PREPARATION_STATUSES.includes(order.status)) {
        stats.inPreparation++;
      }

      if (IN_DELIVERY_STATUSES.includes(order.status)) {
        stats.inDelivery++;
      }

      if (CANCELLED_STATUSES.includes(order.status)) {
        stats.cancelled++;
      }

      // Check local order status
      if (RETURN_STATUSES.includes(order.status)) {
        stats.returned++;
      }

      // Track 'returned' status specifically
      if (order.status === 'returned' || order.status === 'Échec_de_livraison') {
        stats.returnedOnly++;
      }

      // Check RJ360/delivery status for additional failures not caught by local status
      const delivery = deliveryByOrderId.get(order.id);
      if (delivery && isDeliveryFailure(delivery.delivery_status) && !RETURN_STATUSES.includes(order.status)) {
        stats.deliveryFailures++;
      }
    }

    for (const [phone, stats] of grouped) {
      const totalFailures = stats.returnedOnly + stats.cancelled;
      const returnRate = stats.total > 0 ? totalFailures / stats.total : 0;
      let riskLevel: RiskLevel;

      // "Nouveau" only if customer has NO delivered and NO returned/cancelled outcomes yet
      const hasOutcome = stats.delivered > 0 || stats.returnedOnly > 0 || stats.cancelled > 0;

      if (!hasOutcome) {
        riskLevel = 'nouveau';
      } else if (returnRate < 0.2) {
        riskLevel = 'faible';
      } else if (returnRate < 0.8) {
        riskLevel = 'moyen';
      } else {
        riskLevel = 'élevé';
      }

      map.set(phone, {
        phone,
        totalOrders: stats.total,
        returnedOrders: stats.cancelled,
        riskLevel,
        returnRate,
        deliveryFailures: stats.deliveryFailures,
        deliveredOrders: stats.delivered,
        returnedCount: stats.returnedOnly,
        inConfirmation: stats.inConfirmation,
        inPreparation: stats.inPreparation,
        inDelivery: stats.inDelivery,
        cancelledOrders: stats.cancelled,
        activeOrderIds: stats.activeOrderIds,
      });
    }

    for (const [rawPhone, normalizedPhone] of rawToNormalizedPhone) {
      const normalizedRisk = map.get(normalizedPhone);
      if (normalizedRisk) {
        map.set(rawPhone, normalizedRisk);
      }
    }

    return map;
  }, [orders, deliveries]);

  return riskMap;
}

export function useCustomerRisk(phone: string) {
  const riskMap = useReturnRiskData();
  const normalizedPhone = normalizePhoneForRisk(phone);
  return riskMap.get(phone) || riskMap.get(normalizedPhone) || null;
}
