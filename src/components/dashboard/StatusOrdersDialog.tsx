import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { DeliveryCompanyBadge } from '@/components/orders/DeliveryCompanyBadge';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getWilayaLabel } from '@/data/algeriaLocations';
import type { OrderWithItems } from '@/hooks/useOrders';
import type { OrderStatus } from '@/types';

interface StatusOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  statuses: string[];
  orders: OrderWithItems[] | undefined;
  dateRange?: { from?: Date; to?: Date };
  dateField?: keyof OrderWithItems;
}

export function StatusOrdersDialog({ open, onOpenChange, title, statuses, orders, dateRange, dateField }: StatusOrdersDialogProps) {
  const filtered = useMemo(() => {
    if (!orders) return [];
    const field = (dateField || 'updated_at') as keyof OrderWithItems;
    return orders.filter(o => {
      if (statuses.length > 0 && !statuses.includes(o.status)) return false;
      const raw = o[field] as unknown as string | null | undefined;
      if (!raw) return false;
      if (dateRange?.from) {
        const updated = new Date(raw);
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        if (updated < from) return false;
        if (dateRange.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          if (updated > to) return false;
        }
      }
      return true;
    });
  }, [orders, statuses, dateRange, dateField]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-bold">
            {title} — {filtered.length} commande(s)
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">Aucune commande trouvée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">N° Cmd</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Livraison</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatOrderNumber(order.order_number)}
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[150px] truncate">
                      {order.customer_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.customer_phone}
                    </TableCell>
                    <TableCell className="text-xs">
                      {getWilayaLabel(order.wilaya)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      {order.order_items?.map((item, i) => (
                        <span key={item.id}>
                          {i > 0 && ', '}
                          {item.product_name} ×{item.quantity}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {order.total_price.toLocaleString()} DA
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status as OrderStatus} />
                    </TableCell>
                    <TableCell>
                      {order.delivery_company ? (
                        <DeliveryCompanyBadge
                          company={order.delivery_company}
                          trackingNumber={order.tracking_number}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
