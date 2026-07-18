import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useOrders } from '@/hooks/useOrders';
import { useMemo } from 'react';

export function DeliveryPerformanceTable() {
  const { data: orders } = useOrders();

  const deliveryStats = useMemo(() => {
    if (!orders) return [];

    const companyMap: Record<string, { delivered: number; returned: number; inTransit: number; total: number }> = {};

    for (const order of orders) {
      const company = order.delivery_company;
      if (!company) continue;

      if (!companyMap[company]) {
        companyMap[company] = { delivered: 0, returned: 0, inTransit: 0, total: 0 };
      }

      const shippedStatuses = ['shipped', 'delivered', 'delivered_paid', 'returned', 'Échec_de_livraison', 'en_livraison', 'at_station', 'to_station', 'au_bureau'];
      if (!shippedStatuses.includes(order.status)) continue;

      companyMap[company].total++;

      if (order.status === 'delivered' || order.status === 'delivered_paid') {
        companyMap[company].delivered++;
      } else if (order.status === 'returned' || order.status === 'Échec_de_livraison') {
        companyMap[company].returned++;
      } else {
        companyMap[company].inTransit++;
      }
    }

    return Object.entries(companyMap)
      .map(([name, stats]) => ({
        name,
        delivered: stats.delivered,
        returned: stats.returned,
        total: stats.total,
        rate: stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [orders]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Performance Livraison</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="data-table-header">Société</TableHead>
              <TableHead className="data-table-header text-center">Livrés</TableHead>
              <TableHead className="data-table-header text-center">Retours</TableHead>
              <TableHead className="data-table-header text-right">Taux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveryStats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  Aucune donnée
                </TableCell>
              </TableRow>
            ) : (
              deliveryStats.map((company, index) => (
                <TableRow key={index} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-sm">{company.name}</TableCell>
                  <TableCell className="text-center text-sm text-success">{company.delivered}</TableCell>
                  <TableCell className="text-center text-sm text-destructive">{company.returned}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <div className="relative w-10 h-10">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="14" fill="none"
                            stroke={company.rate >= 70 ? 'hsl(var(--success))' : company.rate >= 40 ? 'hsl(38, 92%, 50%)' : 'hsl(var(--destructive))'}
                            strokeWidth="3"
                            strokeDasharray={`${company.rate * 87.96 / 100} 87.96`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">{company.rate}%</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
