import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTopProductRates } from '@/hooks/useOrders';
import { useMemo } from 'react';

interface TopProductsTableProps {
  data: { name: string; quantity: number; revenue: number }[];
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  const top5 = useMemo(() => data.slice(0, 5), [data]);
  const names = useMemo(() => top5.map(p => p.name), [top5]);
  const { data: ratesMap } = useTopProductRates(names);

  const productStats = useMemo(() => {
    return top5.map(p => {
      const s = ratesMap?.[p.name];
      if (!s) return { ...p, orderRate: 0, confirmRate: 0, deliveryRate: 0 };
      const orderRate = s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0;
      const confirmRate = s.total > 0 ? Math.round((s.confirmed / s.total) * 100) : 0;
      const deliveryRate = s.shipped > 0 ? Math.round((s.delivered / s.shipped) * 100) : 0;
      return { ...p, orderRate, confirmRate, deliveryRate };
    });
  }, [top5, ratesMap]);


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
