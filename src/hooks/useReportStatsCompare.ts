import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getChargeAccruedAmount } from '@/lib/chargeCalculations';

export type ComparePeriod = 'day' | 'week' | 'month' | 'year';

export interface KpiSnapshot {
  totalRevenue: number;
  netRevenue: number;
  profit: number;
  profitMargin: number;
  roi: number;
  conversionRate: number;
  totalCOGS: number;
  totalCharges: number;
  totalDeliveryFees: number;
  totalReturnFees: number;
  totalCosts: number;
  avgDeliveryCostPerOrder: number;
  totalCostPerOrder: number;
  totalDeliveredOrders: number;
  totalProductsInOrders: number;
  upsellCount: number;
  upsellRate: number;
  aov: number;
  pov: number;
  uniqueBuyers: number;
  acv: number;
  pcv: number;
}

export interface DailyPoint {
  date: string;
  revenue: number;
  profit: number;
  delivered: number;
  buyers: number;
}

export interface CompareResult {
  current: KpiSnapshot;
  previous: KpiSnapshot;
  series: DailyPoint[];
  rangeDays: number;
}

const EMPTY: KpiSnapshot = {
  totalRevenue: 0, netRevenue: 0, profit: 0, profitMargin: 0, roi: 0, conversionRate: 0,
  totalCOGS: 0, totalCharges: 0, totalDeliveryFees: 0, totalReturnFees: 0, totalCosts: 0,
  avgDeliveryCostPerOrder: 0, totalCostPerOrder: 0, totalDeliveredOrders: 0, totalProductsInOrders: 0,
  upsellCount: 0, upsellRate: 0, aov: 0, pov: 0, uniqueBuyers: 0, acv: 0, pcv: 0,
};

const normalizeWilaya = (w: string): string =>
  (w || '').replace(/^\d+\s*-\s*/, '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '').replace(/\s+/g, ' ');

function shiftRange(from: Date, to: Date, period: ComparePeriod): { from: Date; to: Date } {
  const f = new Date(from);
  const t = new Date(to);
  if (period === 'day') {
    const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
    f.setDate(f.getDate() - days);
    t.setDate(t.getDate() - days);
  } else if (period === 'week') {
    f.setDate(f.getDate() - 7);
    t.setDate(t.getDate() - 7);
  } else if (period === 'month') {
    f.setMonth(f.getMonth() - 1);
    t.setMonth(t.getMonth() - 1);
  } else {
    f.setFullYear(f.getFullYear() - 1);
    t.setFullYear(t.getFullYear() - 1);
  }
  return { from: f, to: t };
}

export function useReportStatsCompare(
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  storeId: string | null | undefined,
  comparePeriod: ComparePeriod = 'day',
) {
  return useQuery<CompareResult>({
    queryKey: ['report-stats-compare', dateFrom?.toISOString(), dateTo?.toISOString(), storeId, comparePeriod],
    enabled: !!dateFrom,
    queryFn: async () => {
      const startCur = new Date(dateFrom!); startCur.setHours(0, 0, 0, 0);
      const endCur = new Date(dateTo || dateFrom!); endCur.setHours(23, 59, 59, 999);
      const prev = shiftRange(startCur, endCur, comparePeriod);
      prev.from.setHours(0, 0, 0, 0);
      prev.to.setHours(23, 59, 59, 999);

      const buildOrdersQuery = (a: Date, b: Date) => {
        let q = supabase.from('orders').select(`
          id, status, total_price, delivery_fee, wilaya, source, delivery_company,
          delivery_type, customer_phone, created_at,
          order_items (quantity, unit_price, product_id, product_name)
        `)
        .gte('created_at', a.toISOString())
        .lte('created_at', b.toISOString());
        if (storeId) q = q.eq('store_id', storeId);
        return q;
      };



      const [curOrders, prevOrders, companyFees, generalFees, localLivreurs, products, allCharges] =
        await Promise.all([
          buildOrdersQuery(startCur, endCur),
          buildOrdersQuery(prev.from, prev.to),
          supabase.from('delivery_company_fees').select('delivery_company, wilaya_name, home_delivery_fee, stop_desk_fee, return_fee'),
          supabase.from('delivery_fees').select('wilaya_name, home_delivery_fee, stop_desk_fee'),
          supabase.from('local_livreurs').select('id, name, tarif, return_tarif') as any,
          supabase.from('products').select('id, purchase_price, average_purchase_price'),
          supabase.from('charges' as any).select('*'),
        ]);

      const companyFeeMap = new Map<string, { home: number; desk: number; return_fee: number }>();
      (companyFees.data || []).forEach((f: any) => {
        const key = `${f.delivery_company}|${normalizeWilaya(f.wilaya_name)}`;
        companyFeeMap.set(key, { home: +f.home_delivery_fee, desk: +f.stop_desk_fee, return_fee: +f.return_fee });
      });
      const generalFeeMap = new Map<string, { home: number; desk: number }>();
      (generalFees.data || []).forEach((f: any) => {
        generalFeeMap.set(normalizeWilaya(f.wilaya_name), { home: +f.home_delivery_fee, desk: +f.stop_desk_fee });
      });
      const localTarif = new Map<string, number>();
      const localReturn = new Map<string, number>();
      (localLivreurs.data || []).forEach((l: any) => {
        localTarif.set(l.name.toLowerCase(), +l.tarif);
        localReturn.set(l.name.toLowerCase(), +(l.return_tarif || 0));
      });
      const productCost = new Map<string, number>();
      (products.data || []).forEach((p: any) => {
        productCost.set(p.id, +(p.average_purchase_price ?? p.purchase_price) || 0);
      });

      const realDeliveryCost = (o: any): number => {
        if (o.delivery_company?.startsWith('local:')) {
          return localTarif.get(o.delivery_company.replace('local:', '').toLowerCase()) || 0;
        }
        const w = normalizeWilaya(o.wilaya);
        const isHome = o.delivery_type === 'home';
        if (o.delivery_company) {
          const cf = companyFeeMap.get(`${o.delivery_company}|${w}`);
          if (cf) return isHome ? cf.home : cf.desk;
        }
        const gf = generalFeeMap.get(w);
        if (gf) return isHome ? gf.home : gf.desk;
        return 0;
      };
      const returnCost = (o: any): number => {
        if (o.delivery_company?.startsWith('local:')) {
          return localReturn.get(o.delivery_company.replace('local:', '').toLowerCase()) || 0;
        }
        const w = normalizeWilaya(o.wilaya);
        if (o.delivery_company) {
          const cf = companyFeeMap.get(`${o.delivery_company}|${w}`);
          if (cf) return cf.return_fee;
        }
        return 0;
      };

      const computeSnapshot = (orders: any[], rangeFrom: Date, rangeTo: Date): KpiSnapshot => {
        const delivered = orders.filter(o => ['delivered', 'delivered_paid'].includes(o.status));
        const returned = orders.filter(o => o.status === 'returned');
        const totalRevenue = delivered.reduce((s, o) => s + +o.total_price, 0);
        const totalDeliveryFees = delivered.reduce((s, o) => s + realDeliveryCost(o), 0);
        const totalReturnFees = returned.reduce((s, o) => s + returnCost(o), 0);
        const totalCOGS = delivered.reduce((s, o) =>
          s + (o.order_items || []).reduce((a: number, it: any) =>
            a + (productCost.get(it.product_id) || 0) * it.quantity, 0), 0);

        // Accrued charges over the range, with per_order/per_product resolver
        const deliveredOrdersByProduct = new Map<string, Set<string>>();
        const deliveredUnitsByProduct = new Map<string, number>();
        let deliveredTotalUnits = 0;
        for (const o of delivered) {
          for (const it of ((o as any).order_items || []) as any[]) {
            const qty = Number(it.quantity) || 0;
            deliveredTotalUnits += qty;
            if (it.product_id) {
              deliveredUnitsByProduct.set(it.product_id, (deliveredUnitsByProduct.get(it.product_id) || 0) + qty);
              const set = deliveredOrdersByProduct.get(it.product_id) || new Set<string>();
              set.add(o.id);
              deliveredOrdersByProduct.set(it.product_id, set);
            }
          }
        }
        const perOrderResolver = (charge: any) => {
          const linked: string[] = (charge.product_ids && charge.product_ids.length)
            ? charge.product_ids
            : (charge.product_id ? [charge.product_id] : []);
          if (charge.frequency === 'per_product') {
            if (linked.length) return linked.reduce((sum, pid) => sum + (deliveredUnitsByProduct.get(pid) || 0), 0);
            return deliveredTotalUnits;
          }
          if (linked.length) {
            const ids = new Set<string>();
            for (const pid of linked) {
              const set = deliveredOrdersByProduct.get(pid);
              if (set) for (const oid of set) ids.add(oid);
            }
            return ids.size;
          }
          return delivered.length;
        };
        const totalCharges = ((allCharges.data || []) as any[]).reduce(
          (s: number, c: any) => s + getChargeAccruedAmount(c, rangeFrom, rangeTo, perOrderResolver),
          0,
        );

        const netRevenue = totalRevenue - totalDeliveryFees - totalReturnFees;
        const profit = netRevenue - totalCOGS - totalCharges;
        const totalCosts = totalCOGS + totalCharges;
        const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
        const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;
        const conversionRate = orders.length > 0 ? (delivered.length / orders.length) * 100 : 0;
        const totalProducts = delivered.reduce((s, o) =>
          s + (o.order_items || []).reduce((a: number, it: any) => a + it.quantity, 0), 0);
        const upsell = delivered.filter(o =>
          (o.order_items || []).reduce((a: number, it: any) => a + it.quantity, 0) > 1).length;
        const upsellRate = delivered.length > 0 ? (upsell / delivered.length) * 100 : 0;
        const aov = delivered.length > 0 ? totalRevenue / delivered.length : 0;
        const pov = delivered.length > 0 ? profit / delivered.length : 0;
        const uniqueBuyers = new Set(delivered.map(o => o.customer_phone)).size;
        const acv = uniqueBuyers > 0 ? totalRevenue / uniqueBuyers : 0;
        const pcv = uniqueBuyers > 0 ? profit / uniqueBuyers : 0;
        const avgDeliveryCostPerOrder = delivered.length > 0 ? totalDeliveryFees / delivered.length : 0;
        const totalCostPerOrder = delivered.length > 0
          ? (totalCOGS + totalCharges) / delivered.length
          : 0;

        return {
          totalRevenue, netRevenue, profit,
          profitMargin: Math.round(profitMargin),
          roi: Math.round(roi),
          conversionRate: Math.round(conversionRate),
          totalCOGS, totalCharges, totalDeliveryFees, totalReturnFees,
          totalCosts: totalCOGS + totalCharges,
          avgDeliveryCostPerOrder: Math.round(avgDeliveryCostPerOrder),
          totalCostPerOrder: Math.round(totalCostPerOrder),
          totalDeliveredOrders: delivered.length,
          totalProductsInOrders: totalProducts,
          upsellCount: upsell,
          upsellRate: Math.round(upsellRate),
          aov: Math.round(aov),
          pov: Math.round(pov),
          uniqueBuyers,
          acv: Math.round(acv),
          pcv: Math.round(pcv),
        };
      };

      const current = computeSnapshot(curOrders.data || [], startCur, endCur);
      const previous = computeSnapshot(prevOrders.data || [], prev.from, prev.to);

      // Daily series (for sparklines) within current range
      const dayKey = (d: Date) => d.toISOString().split('T')[0];
      const dayMap = new Map<string, DailyPoint>();
      const oneDay = 86400000;
      for (let t = startCur.getTime(); t <= endCur.getTime(); t += oneDay) {
        const k = dayKey(new Date(t));
        dayMap.set(k, { date: k, revenue: 0, profit: 0, delivered: 0, buyers: 0 });
      }
      const buyersByDay = new Map<string, Set<string>>();
      (curOrders.data || []).forEach((o: any) => {
        if (!['delivered', 'delivered_paid'].includes(o.status)) return;
        const k = dayKey(new Date(o.created_at));
        const point = dayMap.get(k);
        if (!point) return;
        const rev = +o.total_price;
        const cogs = (o.order_items || []).reduce((a: number, it: any) =>
          a + (productCost.get(it.product_id) || 0) * it.quantity, 0);
        const dfee = realDeliveryCost(o);
        point.revenue += rev;
        point.profit += rev - dfee - cogs;
        point.delivered += 1;
        if (!buyersByDay.has(k)) buyersByDay.set(k, new Set());
        buyersByDay.get(k)!.add(o.customer_phone);
      });
      buyersByDay.forEach((set, k) => {
        const p = dayMap.get(k);
        if (p) p.buyers = set.size;
      });
      const series = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      const rangeDays = series.length;

      return { current, previous, series, rangeDays };
    },
  });
}

export const emptySnapshot = EMPTY;
