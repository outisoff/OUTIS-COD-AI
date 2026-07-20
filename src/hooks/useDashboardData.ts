import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { DashboardFiltersState } from '@/components/dashboard/DashboardFilters';
import type { MapFilterStatus } from '@/hooks/useOrdersByWilaya';
import type { OrderWithItems } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type DashboardItem = OrderItem & {
  products: { purchase_price: number } | null;
};

type DashboardOrder = Order & {
  order_items: DashboardItem[];
  deliveries: { order_id: string | null; delivery_situation: string | null }[];
  order_history: { order_id: string; new_status: Order['status']; created_at: string }[];
};

const PENDING = ['new', 'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6', 'postponed', 'to_reconfirm', 'callback', 'erreur'] as const;
const CONFIRMED = ['confirmed', 'validated'] as const;
const CANCELLED = ['cancelled', 'wrong_number', 'out_of_stock', 'no_answer'] as const;
const PREPARING = ['preparing', 'ready'] as const;
const SHIPPING = ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison'] as const;
const DELIVERED = ['delivered', 'delivered_paid'] as const;
const RETURNED = ['\u00c9chec_de_livraison', 'returned'] as const;

const isOneOf = (status: string, values: readonly string[]) => values.includes(status);

function dayBounds(from?: Date, to?: Date) {
  const start = new Date(from || new Date());
  start.setHours(0, 0, 0, 0);
  const end = new Date(to || start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isInRange(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function buildDailyOrders(orders: DashboardOrder[], from?: Date, to?: Date, dateField: 'created_at' | 'updated_at' = 'created_at') {
  const { start, end } = dayBounds(from, to);
  const periodOrders = orders.filter(order => isInRange(order[dateField], start, end));
  const deliveredStatuses = ['delivered', 'delivered_paid'];
  const cancelledStatuses = ['cancelled', 'wrong_number', 'duplicate', 'out_of_stock', 'no_answer'];
  const failedStatuses = ['\u00c9chec_de_livraison', 'returned'];
  const bucket = (rows: DashboardOrder[]) => ({
    orders: rows.length,
    delivered: rows.filter(o => isOneOf(o.status, deliveredStatuses)).length,
    cancelled: rows.filter(o => isOneOf(o.status, cancelledStatuses)).length,
    failed: rows.filter(o => isOneOf(o.status, failedStatuses)).length,
  });

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return Array.from({ length: 24 }, (_, hour) => ({
      date: `${String(hour).padStart(2, '0')}h`,
      ...bucket(periodOrders.filter(o => new Date(o[dateField]).getHours() === hour)),
    }));
  }

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (totalDays > 90) {
    const result = [];
    const platformStartYear = 2026;
    const endYear = Math.max(end.getFullYear(), platformStartYear);
    for (let year = platformStartYear; year <= endYear; year++) {
      for (let month = 0; month < 12; month++) {
        const monthRows = periodOrders.filter(o => {
          const date = new Date(o[dateField]);
          return date.getFullYear() === year && date.getMonth() === month;
        });
        const name = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        result.push({ date: platformStartYear !== endYear ? `${name} ${String(year).slice(-2)}` : name, ...bucket(monthRows) });
      }
    }
    return result;
  }

  const days = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toDateString();
    const rows = periodOrders.filter(o => new Date(o[dateField]).toDateString() === key);
    days.push({
      date: cursor.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', ''),
      rawDate: `${cursor.getDate()}-${cursor.toLocaleDateString('en-US', { month: 'short' })}`,
      ...bucket(rows),
    });
  }

  if (totalDays > 60) {
    const weeks = [];
    for (let index = 0; index < days.length; index += 7) {
      const rows = days.slice(index, index + 7);
      weeks.push({
        date: rows.length > 1 ? `${rows[0].rawDate} \u2192 ${rows.at(-1)?.rawDate}` : rows[0].rawDate,
        orders: rows.reduce((sum, row) => sum + row.orders, 0),
        delivered: rows.reduce((sum, row) => sum + row.delivered, 0),
        cancelled: rows.reduce((sum, row) => sum + row.cancelled, 0),
        failed: rows.reduce((sum, row) => sum + row.failed, 0),
      });
    }
    return weeks;
  }

  return days.map(({ rawDate: _rawDate, ...day }) => day);
}

export function useDashboardOrdersSource() {
  return useQuery({
    queryKey: ['dashboard-source-v2'],
    queryFn: async () => {
      const pageSize = 1000;
      const orders: DashboardOrder[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            alert, assigned_agent, cancelled_at, commune, confirmed_at, created_at,
            customer_address, customer_id, customer_name, customer_phone, delivered_at,
            delivered_paid_at, delivery_company, delivery_fee, delivery_type, discount,
            id, notes, order_number, pending_at, preparing_at, remarks, returned_at,
            shipped_at, source, status, store_id, total_price, tracking_number, updated_at, wilaya,
            order_items (
              created_at, id, order_id, product_id, product_name, quantity, unit_price, variant,
              products:product_id (purchase_price)
            ),
            deliveries (order_id, delivery_situation),
            order_history (order_id, new_status, created_at)
          `)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as unknown as DashboardOrder[];
        orders.push(...batch);
        if (batch.length < pageSize) break;
        page++;
      }

      return orders;
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useDashboardData(
  from: Date | undefined,
  to: Date | undefined,
  filters: DashboardFiltersState,
  storeId: string | null | undefined,
  dateField: 'created_at' | 'updated_at',
  mapFilter: MapFilterStatus,
) {
  const source = useDashboardOrdersSource();
  const productsQuery = useProducts();

  const calculated = useMemo(() => {
    const allOrders = source.data || [];
    const products = productsQuery.data || [];
    let targetProducts: Set<string> | null = null;
    if (filters.productIds.length || filters.categories.length) {
      const categoryIds = new Set(products.filter(p => filters.categories.includes(p.category)).map(p => p.id));
      const ids = filters.productIds.length
        ? filters.productIds.filter(id => !filters.categories.length || categoryIds.has(id))
        : [...categoryIds];
      targetProducts = new Set(ids);
    }

    const matchesFilters = (order: DashboardOrder) => {
      if (filters.wilayas.length && !filters.wilayas.includes(order.wilaya)) return false;
      if (filters.agents.length && (!order.assigned_agent || !filters.agents.includes(order.assigned_agent))) return false;
      if (filters.deliveryCompanies.length && (!order.delivery_company || !filters.deliveryCompanies.includes(order.delivery_company))) return false;
      if (filters.sources.length && !filters.sources.includes(order.source)) return false;
      if (targetProducts && !order.order_items.some(item => item.product_id && targetProducts?.has(item.product_id))) return false;
      return true;
    };

    const filterMatched = allOrders.filter(matchesFilters);
    const storeOrders = filterMatched.filter(order => !storeId || order.store_id === storeId);
    const { start, end } = dayBounds(from, to);
    const periodOrders = storeOrders.filter(order => isInRange(order[dateField], start, end));
    const nonDuplicatePeriod = periodOrders.filter(order => order.status !== 'duplicate');
    const statusCounts = new Map<string, number>();
    nonDuplicatePeriod.forEach(order => statusCounts.set(order.status, (statusCounts.get(order.status) || 0) + 1));
    const createdStatusCounts = new Map(statusCounts);
    const lifecycleField = (field: keyof DashboardOrder) => dateField === 'updated_at' ? 'updated_at' : field;
    const lifecycleRows = (statuses: readonly string[], field: keyof DashboardOrder) =>
      storeOrders.filter(order => isOneOf(order.status, statuses) && isInRange(order[lifecycleField(field)] as string | null, start, end));

    const pendingRows = lifecycleRows(PENDING, 'pending_at');
    const confirmedRows = lifecycleRows(CONFIRMED, 'confirmed_at');
    const cancelledRows = lifecycleRows(CANCELLED, 'cancelled_at');
    const duplicateRows = storeOrders.filter(order => order.status === 'duplicate' && isInRange(order.updated_at, start, end));
    const preparingRows = lifecycleRows(PREPARING, 'preparing_at');
    const deliveredRows = lifecycleRows(DELIVERED, 'delivered_at');
    const returnedRows = lifecycleRows(RETURNED, 'returned_at');

    for (const [statuses, rows] of [[PENDING, pendingRows], [CONFIRMED, confirmedRows], [CANCELLED, cancelledRows], [PREPARING, preparingRows], [RETURNED, returnedRows]] as const) {
      statuses.forEach(status => statusCounts.set(status, rows.filter(order => order.status === status).length));
    }
    statusCounts.set('duplicate', duplicateRows.length);
    const paidCount = deliveredRows.filter(order => order.status === 'delivered_paid').length;
    const encaisseCount = deliveredRows.filter(order => order.status === 'delivered' && order.deliveries.some(delivery => {
      const situation = (delivery.delivery_situation || '').toLowerCase();
      return situation.includes('encaiss') || situation.includes('recouvert');
    })).length;
    statusCounts.set('delivered', deliveredRows.length - paidCount);
    statusCounts.set('encaisse', encaisseCount);
    statusCounts.set('delivered_paid', paidCount);

    const shippingSet = new Set<string>(SHIPPING);
    const shippingCounts = new Map(SHIPPING.map(status => [status, 0]));
    storeOrders.forEach(order => {
      const hasCandidate = order.order_history.some(history => shippingSet.has(history.new_status) && isInRange(history.created_at, start, end));
      if (!hasCandidate) return;
      const latest = [...order.order_history].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!latest || !shippingSet.has(latest.new_status) || !isInRange(latest.created_at, start, end)) return;
      shippingCounts.set(latest.new_status as typeof SHIPPING[number], (shippingCounts.get(latest.new_status as typeof SHIPPING[number]) || 0) + 1);
    });
    SHIPPING.forEach(status => statusCounts.set(status, shippingCounts.get(status) || 0));

    const revenueToday = deliveredRows.reduce((sum, order) => sum + Number(order.total_price), 0);
    const chargeToday = deliveredRows.reduce((sum, order) => sum + order.order_items.reduce(
      (itemSum, item) => itemSum + Number(item.products?.purchase_price || 0) * item.quantity,
      0,
    ), 0);
    const totalProductsInCommandes = nonDuplicatePeriod.reduce(
      (sum, order) => sum + order.order_items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const orderStats = {
      totalToday: periodOrders.length,
      totalCommandes: periodOrders.length,
      totalProductsInCommandes,
      confirmedToday: confirmedRows.length,
      cancelledToday: cancelledRows.length + duplicateRows.length,
      pendingConfirmations: pendingRows.length,
      preparingToday: preparingRows.length,
      shippedToday: [...shippingCounts.values()].reduce((sum, count) => sum + count, 0),
      deliveredToday: deliveredRows.length,
      echecToday: returnedRows.length,
      revenueToday,
      chargeToday,
      pendingCOD: revenueToday,
      ordersByStatus: [...statusCounts].filter(([, count]) => count > 0).map(([status, count]) => ({ status, count })),
      ordersByStatusCreated: [...createdStatusCounts].filter(([, count]) => count > 0).map(([status, count]) => ({ status, count })),
    };

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const productStats = new Map<string, { quantity: number; revenue: number }>();
    allOrders.filter(order => new Date(order.created_at) >= ninetyDaysAgo).forEach(order => order.order_items.forEach(item => {
      const name = item.product_name.trim();
      const current = productStats.get(name) || { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.quantity * Number(item.unit_price);
      productStats.set(name, current);
    }));
    const topProducts = [...productStats].map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const agentMap = new Map<string, { confirmed: number; cancelled: number; total: number }>();
    const agentConfirmed = ['validated', 'confirmed', 'ready', 'preparing', 'to_station', 'at_station', 'au_bureau', 'shipped', 'en_livraison', 'delivered', 'delivered_paid'];
    const agentCancelled = ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'];
    allOrders.filter(order => (!storeId || order.store_id === storeId) && order.assigned_agent).forEach(order => {
      const name = order.assigned_agent as string;
      const stats = agentMap.get(name) || { confirmed: 0, cancelled: 0, total: 0 };
      if (isOneOf(order.status, agentConfirmed)) stats.confirmed++;
      else if (isOneOf(order.status, agentCancelled)) stats.cancelled++;
      stats.total++;
      agentMap.set(name, stats);
    });
    const agentPerformance = [...agentMap].map(([name, stats]) => ({
      name,
      confirmed: stats.confirmed,
      cancelled: stats.cancelled,
      rate: stats.total ? Math.round((stats.confirmed / stats.total) * 1000) / 10 : 0,
    })).sort((a, b) => b.rate - a.rate);

    const mapStatuses: Record<MapFilterStatus, readonly string[]> = {
      total: [], received: [], confirmed: ['confirmed'], delivered: DELIVERED,
      cancelled: ['cancelled'], returned: RETURNED,
    };
    let mapOrders: DashboardOrder[];
    if (mapFilter === 'total') {
      const received = storeOrders.filter(order => isInRange(order[dateField], start, end) && order.status !== 'duplicate');
      const activity = storeOrders.filter(order => isOneOf(order.status, ['cancelled', ...DELIVERED, ...RETURNED]) && isInRange(order.updated_at, start, end) && order.status !== 'duplicate');
      mapOrders = [...new Map([...received, ...activity].map(order => [order.id, order])).values()];
    } else {
      const field = dateField === 'updated_at' ? 'updated_at' : mapFilter === 'received' ? 'created_at' : 'updated_at';
      mapOrders = storeOrders.filter(order => order.status !== 'duplicate' && isInRange(order[field], start, end) && (!mapStatuses[mapFilter].length || isOneOf(order.status, mapStatuses[mapFilter])));
    }
    const wilayaCounts = mapOrders.reduce((counts, order) => {
      counts[order.wilaya] = (counts[order.wilaya] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      allOrders: allOrders as unknown as OrderWithItems[],
      products,
      filteredOrders: storeOrders as unknown as OrderWithItems[],
      orderStats,
      dailyOrders: buildDailyOrders(storeOrders, from, to, dateField),
      topProducts,
      agentPerformance,
      wilayaCounts,
    };
  }, [source.data, productsQuery.data, filters, storeId, from, to, dateField, mapFilter]);

  return {
    ...calculated,
    isLoading: source.isLoading || productsQuery.isLoading,
    error: source.error || productsQuery.error,
  };
}
