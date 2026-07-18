import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrders } from '@/hooks/useOrders';
import { useMemo } from 'react';

interface TopProductsTableProps {
  data: { name: string; quantity: number; revenue: number }[];
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  const { data: orders } = useOrders();

  const productStats = useMemo(() => {
    if (!orders) return data.slice(0, 5).map(p => ({ ...p, orderRate: 0, confirmRate: 0, deliveryRate: 0 }));

    const productMap: Record<string, { total: number; confirmed: number; cancelled: number; delivered: number; shipped: number }> = {};

    // Same as OrderStatusChart: Livré / Total
    const deliveredStatuses = ['delivered', 'delivered_paid'];

    // Same as ConfirmationRateChart: Confirmé category
    const confirmedStatuses = ['confirmed', 'ready', 'preparing', 'shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'delivered', 'delivered_paid', 'Échec_de_livraison', 'returned', 'erreur'];

    // Same as DeliveryRateChart: all shipped statuses (denominator)
    const shippedStatuses = ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'returned'];

    for (const order of orders) {
      for (const item of order.order_items || []) {
        const name = item.product_name.trim();
        if (!productMap[name]) productMap[name] = { total: 0, confirmed: 0, cancelled: 0, delivered: 0, shipped: 0 };
        productMap[name].total += item.quantity;
        if (confirmedStatuses.includes(order.status)) productMap[name].confirmed += item.quantity;
        if (deliveredStatuses.includes(order.status)) productMap[name].delivered += item.quantity;
        if (shippedStatuses.includes(order.status)) productMap[name].shipped += item.quantity;
      }
    }

    return data.slice(0, 5).map(p => {
      const s = productMap[p.name];
      if (!s) return { ...p, orderRate: 0, confirmRate: 0, deliveryRate: 0 };

      // Taux Commandes: same as OrderStatusChart — Livré / Total
      const orderRate = s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0;
      // Taux Confirmation: same as ConfirmationRateChart — Confirmé / Total
      const confirmRate = s.total > 0 ? Math.round((s.confirmed / s.total) * 100) : 0;
      // Taux Livraison: same as DeliveryRateChart — Livré / Expédiés
      const deliveryRate = s.shipped > 0 ? Math.round((s.delivered / s.shipped) * 100) : 0;

      return { ...p, orderRate, confirmRate, deliveryRate };
    });
  }, [data, orders]);

  const rateColor = (rate: number) =>
    rate >= 70 ? 'text-success' : rate >= 40 ? 'text-orange-500' : 'text-destructive';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Top 5 Produits</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="data-table-header">Produit</TableHead>
              <TableHead className="data-table-header text-center">Qté</TableHead>
              <TableHead className="data-table-header text-center">Cmd</TableHead>
              <TableHead className="data-table-header text-center">Conf.</TableHead>
              <TableHead className="data-table-header text-center">Livr.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productStats.map((product, index) => (
              <TableRow key={index} className="hover:bg-muted/50">
                <TableCell className="font-medium text-sm">{product.name}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{product.quantity}</TableCell>
                <TableCell className="text-center text-sm">
                  <span className={rateColor(product.orderRate)}>{product.orderRate}%</span>
                </TableCell>
                <TableCell className="text-center text-sm">
                  <span className={rateColor(product.confirmRate)}>{product.confirmRate}%</span>
                </TableCell>
                <TableCell className="text-center text-sm">
                  <span className={rateColor(product.deliveryRate)}>{product.deliveryRate}%</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
