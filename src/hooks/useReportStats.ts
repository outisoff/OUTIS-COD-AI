import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getChargeAccruedAmount } from '@/lib/chargeCalculations';

export function useReportStats(dateFrom?: Date, dateTo?: Date, storeId?: string | null) {
  return useQuery({
    queryKey: ['report-stats', dateFrom?.toISOString(), dateTo?.toISOString(), storeId],
    queryFn: async () => {
      const startDay = dateFrom ? new Date(dateFrom) : new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = dateTo ? new Date(dateTo) : new Date(startDay);
      endDay.setHours(23, 59, 59, 999);
      const dayStartISO = startDay.toISOString();
      const dayEndISO = endDay.toISOString();

      // Build orders query with optional store filter
      let ordersQuery = supabase
        .from('orders')
        .select(`
            id, status, total_price, delivery_fee, discount, wilaya, commune,
            assigned_agent, created_at, delivered_at, source, delivery_company,
            delivery_type, customer_phone, store_id,
            order_items (quantity, unit_price, product_id, product_name)
          `)
        .gte('created_at', dayStartISO)
        .lte('created_at', dayEndISO);
      if (storeId) ordersQuery = ordersQuery.eq('store_id', storeId);

      // Fetch orders in date range + delivery company fees in parallel
      const [ordersResult, companyFeesResult, generalFeesResult, localLivreursResult, productsResult, chargesResult] = await Promise.all([
        ordersQuery,
        supabase.from('delivery_company_fees').select('delivery_company, wilaya_name, home_delivery_fee, stop_desk_fee, return_fee'),
        supabase.from('delivery_fees').select('wilaya_name, home_delivery_fee, stop_desk_fee'),
        supabase.from('local_livreurs').select('id, name, tarif, return_tarif') as any,
        supabase.from('products').select('id, purchase_price, average_purchase_price'),
        supabase.from('charges' as any).select('*'),
      ]);


      if (ordersResult.error) throw ordersResult.error;

      // Build fee lookup maps
      const companyFeeMap = new Map<string, { home: number; desk: number; return_fee: number }>();
      (companyFeesResult.data || []).forEach(f => {
        companyFeeMap.set(`${f.delivery_company}|${f.wilaya_name}`, { 
          home: Number(f.home_delivery_fee), desk: Number(f.stop_desk_fee), return_fee: Number(f.return_fee) 
        });
      });
      const generalFeeMap = new Map<string, { home: number; desk: number }>();
      (generalFeesResult.data || []).forEach(f => {
        generalFeeMap.set(f.wilaya_name, { home: Number(f.home_delivery_fee), desk: Number(f.stop_desk_fee) });
      });
      // Local livreurs: map by name (delivery_company = "local:{name}")
      const localLivreurMap = new Map<string, number>();
      const localLivreurReturnMap = new Map<string, number>();
      (localLivreursResult.data || []).forEach((l: any) => {
        localLivreurMap.set(l.name.toLowerCase(), Number(l.tarif));
        localLivreurReturnMap.set(l.name.toLowerCase(), Number(l.return_tarif || 0));
      });

      // Normalize wilaya: strip prefix, accents, apostrophes for matching
      const normalizeWilaya = (w: string): string => {
        return w
          .replace(/^\d+\s*-\s*/, '')  // strip "15 - " prefix
          .trim()
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
          .replace(/'/g, '')  // remove apostrophes (M'Sila -> msila)
          .replace(/\s+/g, ' '); // normalize spaces
      };

      // Also normalize the fee map keys for matching
      const companyFeeMapNorm = new Map<string, { home: number; desk: number; return_fee: number }>();
      companyFeeMap.forEach((v, k) => {
        const [company, wilaya] = k.split('|');
        const normKey = `${company}|${normalizeWilaya(wilaya)}`;
        companyFeeMapNorm.set(normKey, v);
      });
      const generalFeeMapNorm = new Map<string, { home: number; desk: number }>();
      generalFeeMap.forEach((v, k) => {
        generalFeeMapNorm.set(normalizeWilaya(k), v);
      });

      // Calculate real delivery cost for an order
      const getRealDeliveryCost = (o: any): number => {
        if (o.delivery_company && o.delivery_company.startsWith('local:')) {
          const livreurName = o.delivery_company.replace('local:', '').toLowerCase();
          return localLivreurMap.get(livreurName) || 0;
        }
        const isHome = o.delivery_type === 'home';
        const wilayaNorm = normalizeWilaya(o.wilaya);
        if (o.delivery_company) {
          const key = `${o.delivery_company}|${wilayaNorm}`;
          const cf = companyFeeMap.get(`${o.delivery_company}|${o.wilaya}`) || companyFeeMapNorm.get(key);
          if (cf) return isHome ? cf.home : cf.desk;
        }
        const gf = generalFeeMap.get(o.wilaya) || generalFeeMapNorm.get(wilayaNorm);
        if (gf) return isHome ? gf.home : gf.desk;
        return 0;
      };

      const getReturnCost = (o: any): number => {
        if (o.delivery_company && o.delivery_company.startsWith('local:')) {
          const livreurName = o.delivery_company.replace('local:', '').toLowerCase();
          return localLivreurReturnMap.get(livreurName) || 0;
        }
        const wilayaNorm = normalizeWilaya(o.wilaya);
        if (o.delivery_company) {
          const key = `${o.delivery_company}|${wilayaNorm}`;
          const cf = companyFeeMap.get(`${o.delivery_company}|${o.wilaya}`) || companyFeeMapNorm.get(key);
          if (cf) return cf.return_fee;
        }
        return 0;
      };

      const orders = ordersResult.data;

      const allOrders = orders || [];
      const totalOrders = allOrders.length;

      // Status counts
      const statusCounts: Record<string, number> = {};
      allOrders.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });

      const delivered = allOrders.filter(o => ['delivered', 'delivered_paid'].includes(o.status));
      const deliveredNotPaid = allOrders.filter(o => o.status === 'delivered');
      const deliveredPaid = allOrders.filter(o => o.status === 'delivered_paid');
      const cancelled = allOrders.filter(o => ['cancelled', 'wrong_number', 'duplicate', 'out_of_stock'].includes(o.status));
      const returned = allOrders.filter(o => o.status === 'returned');
      const failed = allOrders.filter(o => o.status === 'Échec_de_livraison');
      const shipped = allOrders.filter(o => ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'returned'].includes(o.status));

      // Build product purchase price map
      const productCostMap = new Map<string, number>();
      (productsResult.data || []).forEach(p => {
        const cost = Number(p.average_purchase_price) || Number(p.purchase_price) || 0;
        productCostMap.set(p.id, cost);
      });

      const totalRevenue = delivered.reduce((s, o) => s + Number(o.total_price), 0);
      // Real delivery costs = what you actually pay to delivery companies (from tariff tables)
      const totalDeliveryFees = delivered.reduce((s, o) => s + getRealDeliveryCost(o), 0);
      const totalReturnFees = returned.reduce((s, o) => s + getReturnCost(o), 0);
      const totalDiscount = allOrders.reduce((s, o) => s + Number(o.discount), 0);
      // Client-facing delivery fees (what clients paid)
      const totalClientDeliveryFees = delivered.reduce((s, o) => s + Number(o.delivery_fee), 0);
      // COGS: cost of goods sold for delivered orders
      const totalCOGS = delivered.reduce((s, o) => {
        return s + (o.order_items || []).reduce((itemSum: number, item: any) => {
          const unitCost = item.product_id ? (productCostMap.get(item.product_id) || 0) : 0;
          return itemSum + unitCost * item.quantity;
        }, 0);
      }, 0);

      // Total charges accrued over the period (recurrence-aware + per_order/per_product aware)
      // Build resolvers from already-fetched delivered orders for per_order/per_product charges.
      const deliveredOrders = delivered;
      const deliveredOrdersByStore = new Map<string, number>();
      const deliveredOrdersByProduct = new Map<string, Set<string>>();
      const deliveredUnitsByProduct = new Map<string, number>();
      const deliveredUnitsByStore = new Map<string, number>();
      let deliveredTotalUnits = 0;
      for (const o of deliveredOrders) {
        const sid = (o as any).store_id as string | null;
        if (sid) deliveredOrdersByStore.set(sid, (deliveredOrdersByStore.get(sid) || 0) + 1);
        for (const it of ((o as any).order_items || []) as any[]) {
          const qty = Number(it.quantity) || 0;
          deliveredTotalUnits += qty;
          if (sid) deliveredUnitsByStore.set(sid, (deliveredUnitsByStore.get(sid) || 0) + qty);
          if (it.product_id) {
            deliveredUnitsByProduct.set(it.product_id, (deliveredUnitsByProduct.get(it.product_id) || 0) + qty);
            const set = deliveredOrdersByProduct.get(it.product_id) || new Set<string>();
            set.add(o.id);
            deliveredOrdersByProduct.set(it.product_id, set);
          }
        }
      }
      const deliveredOrdersTotal = deliveredOrders.length;
      const perOrderResolver = (charge: any) => {
        const linkedProductIds: string[] = (charge.product_ids && charge.product_ids.length)
          ? charge.product_ids
          : (charge.product_id ? [charge.product_id] : []);
        if (charge.frequency === 'per_product') {
          if (linkedProductIds.length) {
            return linkedProductIds.reduce((sum, pid) => sum + (deliveredUnitsByProduct.get(pid) || 0), 0);
          }
          if (charge.store_id) return deliveredUnitsByStore.get(charge.store_id) || 0;
          return deliveredTotalUnits;
        }
        if (linkedProductIds.length) {
          const ids = new Set<string>();
          for (const pid of linkedProductIds) {
            const set = deliveredOrdersByProduct.get(pid);
            if (set) for (const oid of set) ids.add(oid);
          }
          return ids.size;
        }
        if (charge.store_id) return deliveredOrdersByStore.get(charge.store_id) || 0;
        return deliveredOrdersTotal;
      };
      const totalCharges = ((chargesResult.data || []) as any[]).reduce(
        (s: number, c: any) => s + getChargeAccruedAmount(c, startDay, endDay, perOrderResolver),
        0,
      );
      // Delivery rate
      const deliveryRate = shipped.length > 0 ? Math.round((delivered.length / shipped.length) * 1000) / 10 : 0;
      const failRate = shipped.length > 0 ? Math.round(((failed.length + returned.length) / shipped.length) * 1000) / 10 : 0;
      const cancelRate = totalOrders > 0 ? Math.round((cancelled.length / totalOrders) * 1000) / 10 : 0;
      const confirmRate = totalOrders > 0 ? Math.round(((totalOrders - cancelled.length) / totalOrders) * 1000) / 10 : 0;

      // Top wilayas
      const wilayaCounts: Record<string, { orders: number; delivered: number; revenue: number }> = {};
      allOrders.forEach(o => {
        if (!wilayaCounts[o.wilaya]) wilayaCounts[o.wilaya] = { orders: 0, delivered: 0, revenue: 0 };
        wilayaCounts[o.wilaya].orders++;
        if (['delivered', 'delivered_paid'].includes(o.status)) {
          wilayaCounts[o.wilaya].delivered++;
          wilayaCounts[o.wilaya].revenue += Number(o.total_price);
        }
      });
      const topWilayas = Object.entries(wilayaCounts)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10);

      // Source distribution
      const sourceCounts: Record<string, number> = {};
      allOrders.forEach(o => {
        sourceCounts[o.source] = (sourceCounts[o.source] || 0) + 1;
      });

      // Agent performance
      const agentStats: Record<string, { total: number; confirmed: number; cancelled: number; delivered: number }> = {};
      const confirmedStatuses = ['validated', 'confirmed', 'ready', 'preparing', 'to_station', 'at_station', 'au_bureau', 'shipped', 'delivered', 'delivered_paid', 'en_livraison'];
      const cancelledStatuses = ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'];

      allOrders.forEach(o => {
        const agent = o.assigned_agent || 'Non assigné';
        if (agent === 'Non assigné') return;
        if (!agentStats[agent]) agentStats[agent] = { total: 0, confirmed: 0, cancelled: 0, delivered: 0 };
        agentStats[agent].total++;
        if (confirmedStatuses.includes(o.status)) agentStats[agent].confirmed++;
        if (cancelledStatuses.includes(o.status)) agentStats[agent].cancelled++;
        if (['delivered', 'delivered_paid'].includes(o.status)) agentStats[agent].delivered++;
      });

      const agents = Object.entries(agentStats)
        .map(([name, stats]) => ({
          name,
          total: stats.total,
          confirmed: stats.confirmed,
          cancelled: stats.cancelled,
          delivered: stats.delivered,
          confirmRate: stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.confirmRate - a.confirmRate);

      // Top products
      const productStats: Record<string, { quantity: number; revenue: number }> = {};
      delivered.forEach(o => {
        o.order_items?.forEach((item: any) => {
          const name = item.product_name;
          if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 };
          productStats[name].quantity += item.quantity;
          productStats[name].revenue += item.quantity * Number(item.unit_price);
        });
      });
      const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Delivery company stats
      const companyCounts: Record<string, { total: number; delivered: number; failed: number }> = {};
      allOrders.filter(o => o.delivery_company).forEach(o => {
        const company = o.delivery_company!;
        if (!companyCounts[company]) companyCounts[company] = { total: 0, delivered: 0, failed: 0 };
        companyCounts[company].total++;
        if (['delivered', 'delivered_paid'].includes(o.status)) companyCounts[company].delivered++;
        if (['Échec_de_livraison', 'returned'].includes(o.status)) companyCounts[company].failed++;
      });
      const deliveryCompanies = Object.entries(companyCounts)
        .map(([name, stats]) => ({
          name,
          ...stats,
          successRate: stats.total > 0 ? Math.round((stats.delivered / stats.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Upsell: delivered orders with total quantity > 1
      const upsellOrders = delivered.filter(o => {
        const totalQty = (o.order_items || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
        return totalQty > 1;
      });
      const upsellRate = delivered.length > 0 ? Math.round((upsellOrders.length / delivered.length) * 1000) / 10 : 0;

      // Total products (sum of all quantities) across delivered orders only
      const totalProductsInOrders = delivered.reduce((sum, o) => {
        return sum + (o.order_items || []).reduce((s: number, item: any) => s + item.quantity, 0);
      }, 0);

      // Total delivered orders count (livré + livré payé)
      const totalDeliveredOrders = delivered.length;

      return {
        totalOrders,
        totalDeliveredOrders,
        totalProductsInOrders,
        totalRevenue,
        totalDeliveryFees,
        totalReturnFees,
        totalDiscount,
        totalClientDeliveryFees,
        totalCOGS,
        totalCharges,
        uniqueBuyers: new Set(delivered.map(o => o.customer_phone)).size,
        deliveredCount: delivered.length,
        deliveredNotPaidRevenue: deliveredNotPaid.reduce((s, o) => s + Number(o.total_price), 0),
        deliveredPaidRevenue: deliveredPaid.reduce((s, o) => s + Number(o.total_price), 0),
        cancelledCount: cancelled.length,
        returnedCount: returned.length,
        failedCount: failed.length,
        shippedCount: shipped.length,
        upsellCount: upsellOrders.length,
        upsellRate,
        deliveryRate,
        failRate,
        cancelRate,
        confirmRate,
        statusCounts,
        topWilayas,
        sourceCounts,
        agents,
        topProducts,
        deliveryCompanies,
      };
    },
  });
}
