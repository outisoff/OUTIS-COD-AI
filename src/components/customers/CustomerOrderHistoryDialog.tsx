import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export type OrderHistoryFilter = 'all' | 'confirmation' | 'preparation' | 'delivery' | 'delivered' | 'returned' | 'failed';

interface CustomerOrderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone: string;
  customerName: string;
  statusFilter?: OrderHistoryFilter;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  new: { label: 'Nouveau', className: 'bg-blue-100 text-blue-700' },
  validated: { label: 'Validée', className: 'bg-primary/10 text-primary' },
  confirmed: { label: 'Confirmée', className: 'bg-success/10 text-success' },
  cancelled: { label: 'Annulée', className: 'bg-destructive/10 text-destructive' },
  shipped: { label: 'Expédiée', className: 'bg-orange-100 text-orange-700' },
  delivered: { label: 'Livrée', className: 'bg-success/10 text-success' },
  delivered_paid: { label: 'Livrée Payée', className: 'bg-success/10 text-success' },
  returned: { label: 'Retournée', className: 'bg-destructive/10 text-destructive' },
  failed_1: { label: 'Échoué 1', className: 'bg-destructive/10 text-destructive' },
  failed_2: { label: 'Échoué 2', className: 'bg-destructive/10 text-destructive' },
  failed_3: { label: 'Échoué 3', className: 'bg-destructive/10 text-destructive' },
  failed_4: { label: 'Échoué 4', className: 'bg-destructive/10 text-destructive' },
  failed_5: { label: 'Échoué 5', className: 'bg-destructive/10 text-destructive' },
  failed_6: { label: 'Échoué 6', className: 'bg-destructive/10 text-destructive' },
  no_answer: { label: 'Pas de réponse', className: 'bg-muted text-muted-foreground' },
  wrong_number: { label: 'Faux numéro', className: 'bg-muted text-muted-foreground' },
  duplicate: { label: 'Doublon', className: 'bg-muted text-muted-foreground' },
  out_of_stock: { label: 'Rupture', className: 'bg-muted text-muted-foreground' },
  postponed: { label: 'Reportée', className: 'bg-warning/10 text-warning' },
  to_reconfirm: { label: 'À reconfirmer', className: 'bg-warning/10 text-warning' },
  callback: { label: 'Rappel', className: 'bg-warning/10 text-warning' },
  preparing: { label: 'En préparation', className: 'bg-purple-100 text-purple-700' },
  ready: { label: 'Prête', className: 'bg-primary/10 text-primary' },
  en_livraison: { label: 'En livraison', className: 'bg-orange-100 text-orange-700' },
  at_station: { label: 'Au bureau', className: 'bg-orange-100 text-orange-700' },
  to_station: { label: 'Vers bureau', className: 'bg-orange-100 text-orange-700' },
  au_bureau: { label: 'Au bureau', className: 'bg-orange-100 text-orange-700' },
  alerte: { label: 'Alerte', className: 'bg-destructive/10 text-destructive' },
  exchange: { label: 'Échange', className: 'bg-warning/10 text-warning' },
  'Échec_de_livraison': { label: 'Échec livraison', className: 'bg-destructive/10 text-destructive' },
  erreur: { label: 'Erreur', className: 'bg-destructive/10 text-destructive' },
};

const FILTER_STATUS_MAP: Record<OrderHistoryFilter, string[]> = {
  all: [],
  confirmation: ['new', 'validated', 'confirmed', 'callback', 'postponed', 'to_reconfirm', 'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6', 'erreur'],
  preparation: ['preparing', 'ready'],
  delivery: ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'alerte'],
  delivered: ['delivered', 'delivered_paid'],
  returned: ['returned'],
  failed: ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'],
};

const FILTER_LABELS: Record<OrderHistoryFilter, string> = {
  all: 'Toutes les commandes',
  confirmation: 'En confirmation',
  preparation: 'En préparation',
  delivery: 'En livraison',
  delivered: 'Livrées',
  returned: 'Retours',
  failed: 'Échecs',
};

export function CustomerOrderHistoryDialog({ open, onOpenChange, customerPhone, customerName, statusFilter = 'all' }: CustomerOrderHistoryDialogProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['customer-orders', customerPhone],
    queryFn: async () => {
      const phoneVariants: string[] = [customerPhone];
      if (customerPhone.startsWith('0')) {
        phoneVariants.push('+213' + customerPhone.slice(1));
      } else if (customerPhone.startsWith('+213')) {
        phoneVariants.push('0' + customerPhone.slice(4));
      }
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_price, delivery_fee, created_at, wilaya, commune, order_items(id, product_name, quantity, variant)')
        .in('customer_phone', phoneVariants)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!customerPhone,
  });

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === 'all') return orders;
    const allowedStatuses = FILTER_STATUS_MAP[statusFilter];
    if (!allowedStatuses || allowedStatuses.length === 0) return orders;
    return orders.filter(o => allowedStatuses.includes(o.status));
  }, [orders, statusFilter]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-DZ').format(value) + ' DA';

  const filterLabel = FILTER_LABELS[statusFilter] || 'Toutes les commandes';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Historique — {customerName}
            {statusFilter !== 'all' && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({filterLabel})</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Commande</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const st = statusLabels[order.status] || { label: order.status, className: 'bg-muted text-muted-foreground' };
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-sm">{order.order_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        {order.order_items?.map((item: any) => (
                          <div key={item.id} className="truncate">
                            {item.product_name}{item.variant ? ` (${item.variant})` : ''} <span className="font-medium text-primary">x{item.quantity}</span>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-sm">{order.wilaya}{order.commune ? ` - ${order.commune}` : ''}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(order.total_price)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.className}`}>
                          {st.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Aucune commande trouvée</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
