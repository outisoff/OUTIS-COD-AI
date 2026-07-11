import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomers } from '@/hooks/useCustomers';
import { getWilayaLabel } from '@/data/algeriaLocations';
import { AlertTriangle } from 'lucide-react';

export default function CustomersRisk() {
  const { data: customers, isLoading } = useCustomers();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  // Filter customers with high return/failure rates
  const riskCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => {
      // Consider customers with orders who have concerning patterns
      if (c.total_orders < 2) return false;
      // Customers marked as blacklisted or with status issues
      return c.status === 'blacklisted' || c.total_orders >= 3;
    }).sort((a, b) => b.total_orders - a.total_orders);
  }, [customers]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Clients à Risque</h1>
        <p className="page-description">
          Clients avec un historique de retours ou d'échecs élevé ({riskCustomers.length} total)
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Clients à Risque ({riskCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : riskCustomers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="data-table-header">Client</TableHead>
                  <TableHead className="data-table-header">Téléphone</TableHead>
                  <TableHead className="data-table-header">Wilaya</TableHead>
                  <TableHead className="data-table-header text-right">Commandes</TableHead>
                  <TableHead className="data-table-header text-right">Total Dépensé</TableHead>
                  <TableHead className="data-table-header">Dernière Commande</TableHead>
                  <TableHead className="data-table-header">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-warning/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-warning">{customer.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.commune || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{customer.phone}</TableCell>
                    <TableCell className="text-sm">{getWilayaLabel(customer.wilaya)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{customer.total_orders}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(Number(customer.total_spent))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.last_order_date
                        ? format(new Date(customer.last_order_date), 'dd MMM yyyy', { locale: fr })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <span className="status-badge bg-warning/10 text-warning">À risque</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Aucun client à risque détecté</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
