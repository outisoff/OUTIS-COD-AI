import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardOrdersSource } from '@/hooks/useDashboardData';
import { useProducts } from '@/hooks/useProducts';

export interface SmartAlert {
  id: string;
  type: 'customer_risk' | 'low_stock' | 'out_of_stock' | 'system';
  severity: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  link?: string;
  createdAt: string;
}

// Reuse the main orders cache instead of a separate fetch
function useCustomerRiskAlerts(): SmartAlert[] {
  const { data: orders } = useDashboardOrdersSource();

  return useMemo(() => {
    if (!orders?.length) return [];

    // Group orders by customer phone
    const customerOrders: Record<string, NonNullable<typeof orders>> = {};
    for (const order of orders) {
      const key = order.customer_phone;
      if (!customerOrders[key]) customerOrders[key] = [];
      customerOrders[key].push(order);
    }

    const failStatuses = [
      'returned', 'Échec_de_livraison', 'cancelled', 'erreur',
      'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6',
    ];

    const alerts: SmartAlert[] = [];

    for (const [phone, custOrders] of Object.entries(customerOrders)) {
      // Sort by date desc
      const sorted = custOrders.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Check consecutive failures from most recent
      let consecutiveFails = 0;
      for (const o of sorted) {
        if (failStatuses.includes(o.status)) {
          consecutiveFails++;
        } else {
          break;
        }
      }

      if (consecutiveFails >= 2) {
        const name = sorted[0].customer_name;
        alerts.push({
          id: `risk-${phone}`,
          type: 'customer_risk',
          severity: consecutiveFails >= 3 ? 'critical' : 'warning',
          title: `Client à risque: ${name}`,
          message: `${consecutiveFails} commandes échouées consécutives (${phone})`,
          link: '/customers',
          createdAt: sorted[0].created_at,
        });
      }
    }

    return alerts;
  }, [orders]);
}

// Fetch products approaching stock depletion
function useStockAlerts(): SmartAlert[] {
  const { data: products } = useProducts();

  return useMemo(() => {
    if (!products?.length) return [];

    const alerts: SmartAlert[] = [];

    for (const product of products) {
      const available = product.current_stock - product.reserved_stock;

      if (available <= 0) {
        alerts.push({
          id: `stock-${product.id}`,
          type: 'out_of_stock',
          severity: 'critical',
          title: `Rupture: ${product.name}`,
          message: `Stock disponible: 0 (Réservé: ${product.reserved_stock})`,
          link: '/stock',
          createdAt: new Date().toISOString(),
        });
      } else if (available <= product.reorder_level) {
        alerts.push({
          id: `stock-${product.id}`,
          type: 'low_stock',
          severity: 'warning',
          title: `Stock faible: ${product.name}`,
          message: `${available} restant (seuil: ${product.reorder_level})`,
          link: '/stock',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }, [products]);
}

// Fetch recent DB alerts (from webhooks etc)
function useSystemAlerts(): SmartAlert[] {
  const { data: dbAlerts } = useQuery({
    queryKey: ['db-alerts-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('id, type, message, is_read, created_at')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000, // 1 min
  });

  return useMemo(() => {
    if (!dbAlerts?.length) return [];
    return dbAlerts.map((a) => ({
      id: a.id,
      type: 'system' as const,
      severity: (a.type === 'critical' || a.type === 'error' ? 'critical' : a.type === 'warning' ? 'warning' : 'info') as SmartAlert['severity'],
      title: a.type === 'error' || a.type === 'critical' ? '⚠️ Alerte système' : '📬 Mise à jour',
      message: a.message,
      link: '/orders',
      createdAt: a.created_at || new Date().toISOString(),
    }));
  }, [dbAlerts]);
}

export function useSmartAlerts() {
  const customerAlerts = useCustomerRiskAlerts();
  const stockAlerts = useStockAlerts();
  const systemAlerts = useSystemAlerts();

  const allAlerts = useMemo(() => {
    const combined = [...customerAlerts, ...stockAlerts, ...systemAlerts];
    // Sort: critical first, then by date
    return combined.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const diff = severityOrder[a.severity] - severityOrder[b.severity];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [customerAlerts, stockAlerts, systemAlerts]);

  return {
    alerts: allAlerts,
    criticalCount: allAlerts.filter((a) => a.severity === 'critical').length,
    totalCount: allAlerts.length,
    customerAlerts,
    stockAlerts,
    systemAlerts,
  };
}
