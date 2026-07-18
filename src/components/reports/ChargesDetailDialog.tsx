import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Receipt, ShoppingCart, Package } from 'lucide-react';

const formatCurrency = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v)) + ' DA';
const formatNumber = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalCharges: number;
  totalDeliveredOrders: number;
  totalProductsInOrders?: number;
}

export function ChargesDetailDialog({ open, onOpenChange, totalCharges, totalDeliveredOrders, totalProductsInOrders = 0 }: Props) {
  const avgPerOrder = totalDeliveredOrders > 0 ? totalCharges / totalDeliveredOrders : 0;
  const avgPerProduct = totalProductsInOrders > 0 ? totalCharges / totalProductsInOrders : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-warning" />
            Détail des charges
          </DialogTitle>
          <DialogDescription>
            Répartition des charges sur la période sélectionnée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Total */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Charges totales</p>
                <p className="text-xs text-muted-foreground mt-0.5">Somme de toutes les charges enregistrées</p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground whitespace-nowrap">
              {formatCurrency(totalCharges)}
            </p>
          </div>

          {/* Avg per order */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Charge moyenne / commande livrée</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(totalCharges)} ÷ {formatNumber(totalDeliveredOrders)} commande{totalDeliveredOrders > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground whitespace-nowrap">
              {formatCurrency(avgPerOrder)}
            </p>
          </div>

          {/* Avg per product */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Charge moyenne / produit livré</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(totalCharges)} ÷ {formatNumber(totalProductsInOrders)} produit{totalProductsInOrders > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground whitespace-nowrap">
              {formatCurrency(avgPerProduct)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
