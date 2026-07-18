import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DollarSign, ShoppingCart, Package, type LucideIcon } from 'lucide-react';

const formatCurrency = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v)) + ' DA';
const formatNumber = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v));

interface Row {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  hint: string;
  value: number;
  isNegative?: boolean;
  isTotal?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  headerIcon: LucideIcon;
  headerIconColor: string;
  totalValue: number;
  totalDeliveredOrders: number;
  totalProductsInOrders: number;
  rows: Row[];
}

export function RevenueDetailDialog({
  open, onOpenChange, title, description, headerIcon: HeaderIcon, headerIconColor,
  totalValue, totalDeliveredOrders, totalProductsInOrders, rows,
}: Props) {
  const avgPerOrder = totalDeliveredOrders > 0 ? totalValue / totalDeliveredOrders : 0;
  const avgPerProduct = totalProductsInOrders > 0 ? totalValue / totalProductsInOrders : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeaderIcon className={`h-5 w-5 ${headerIconColor}`} />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {rows.map((r, idx) => {
            const Icon = r.icon;
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                  r.isTotal ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg ${r.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${r.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.hint}</p>
                  </div>
                </div>
                <p className={`text-lg font-bold tabular-nums whitespace-nowrap ${
                  r.isNegative ? 'text-destructive' : r.isTotal ? 'text-primary' : 'text-foreground'
                }`}>
                  {r.isNegative && r.value > 0 ? '−' : ''}{formatCurrency(r.value)}
                </p>
              </div>
            );
          })}

          {/* Avg per delivered order */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Moyenne / commande livrée</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(totalValue)} ÷ {formatNumber(totalDeliveredOrders)} commande{totalDeliveredOrders > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground whitespace-nowrap">
              {formatCurrency(avgPerOrder)}
            </p>
          </div>

          {/* Avg per delivered product */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Moyenne / produit livré</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(totalValue)} ÷ {formatNumber(totalProductsInOrders)} produit{totalProductsInOrders > 1 ? 's' : ''}
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
