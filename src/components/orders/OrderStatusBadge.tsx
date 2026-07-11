import { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types';

interface OrderStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; className: string; buttonClassName: string; dotColor: string }> = {
  new: { label: 'Nouveau', className: 'bg-primary/10 text-primary border border-primary/20', buttonClassName: 'bg-primary hover:bg-primary/90 text-primary-foreground', dotColor: 'bg-blue-500' },
  validated: { label: 'Validé', className: 'bg-success/10 text-success border border-success/20', buttonClassName: 'bg-success hover:bg-success/90 text-white', dotColor: 'bg-green-500' },
  confirmed: { label: 'Confirmé', className: 'bg-success/20 text-success border border-success/30', buttonClassName: 'bg-success hover:bg-success/90 text-white', dotColor: 'bg-green-600' },
  cancelled: { label: 'Annulé', className: 'bg-destructive/10 text-destructive border border-destructive/20', buttonClassName: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground', dotColor: 'bg-red-500' },
  failed_1: { label: 'Échoué - 1', className: 'bg-warning/10 text-warning border border-warning/20', buttonClassName: 'bg-warning hover:bg-warning/90 text-warning-foreground', dotColor: 'bg-amber-500' },
  failed_2: { label: 'Échoué - 2', className: 'bg-warning/20 text-warning border border-warning/30', buttonClassName: 'bg-warning hover:bg-warning/90 text-warning-foreground', dotColor: 'bg-amber-500' },
  failed_3: { label: 'Échoué - 3', className: 'bg-warning/30 text-warning border border-warning/40', buttonClassName: 'bg-warning hover:bg-warning/90 text-warning-foreground', dotColor: 'bg-amber-600' },
  failed_4: { label: 'Échoué - 4', className: 'bg-orange-500/10 text-orange-600 border border-orange-500/20', buttonClassName: 'bg-orange-500 hover:bg-orange-500/90 text-white', dotColor: 'bg-orange-500' },
  failed_5: { label: 'Échoué - 5', className: 'bg-orange-500/20 text-orange-600 border border-orange-500/30', buttonClassName: 'bg-orange-500 hover:bg-orange-500/90 text-white', dotColor: 'bg-orange-500' },
  failed_6: { label: 'Échoué 3 (D-2)', className: 'bg-orange-500/30 text-orange-600 border border-orange-500/40', buttonClassName: 'bg-orange-500 hover:bg-orange-500/90 text-white', dotColor: 'bg-orange-600' },
  no_answer: { label: 'Répondre pas', className: 'bg-muted text-muted-foreground border border-border', buttonClassName: 'bg-muted hover:bg-muted/90 text-muted-foreground', dotColor: 'bg-gray-400' },
  wrong_number: { label: 'Faux numéro', className: 'bg-destructive/10 text-destructive border border-destructive/20', buttonClassName: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground', dotColor: 'bg-red-500' },
  postponed: { label: 'Reporter', className: 'bg-chart-5/10 text-chart-5 border border-chart-5/20', buttonClassName: 'bg-chart-5 hover:bg-chart-5/90 text-white', dotColor: 'bg-fuchsia-500' },
  to_reconfirm: { label: 'A reconfirmer', className: 'bg-chart-6/10 text-chart-6 border border-chart-6/20', buttonClassName: 'bg-chart-6 hover:bg-chart-6/90 text-white', dotColor: 'bg-fuchsia-500' },
  callback: { label: 'Me rappelez', className: 'bg-chart-6/20 text-chart-6 border border-chart-6/30', buttonClassName: 'bg-chart-6 hover:bg-chart-6/90 text-white', dotColor: 'bg-fuchsia-600' },
  duplicate: { label: 'Dupliquer', className: 'bg-muted text-muted-foreground border border-border', buttonClassName: 'bg-muted hover:bg-muted/90 text-muted-foreground', dotColor: 'bg-gray-400' },
  out_of_stock: { label: 'Fin de stock', className: 'bg-destructive/10 text-destructive border border-destructive/20', buttonClassName: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground', dotColor: 'bg-red-500' },
  ready: { label: 'Prêt', className: 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20', buttonClassName: 'bg-cyan-500 hover:bg-cyan-500/90 text-white', dotColor: 'bg-cyan-500' },
  preparing: { label: 'En Préparation', className: 'bg-orange-500/10 text-orange-600 border border-orange-500/20', buttonClassName: 'bg-orange-500 hover:bg-orange-500/90 text-white', dotColor: 'bg-orange-500' },
  to_station: { label: 'Vers station', className: 'bg-violet-500/10 text-violet-600 border border-violet-500/20', buttonClassName: 'bg-violet-500 hover:bg-violet-500/90 text-white', dotColor: 'bg-violet-500' },
  at_station: { label: 'En station', className: 'bg-violet-500/10 text-violet-600 border border-violet-500/20', buttonClassName: 'bg-violet-500 hover:bg-violet-500/90 text-white', dotColor: 'bg-violet-600' },
  au_bureau: { label: 'Au bureau', className: 'bg-blue-500/10 text-blue-600 border border-blue-500/20', buttonClassName: 'bg-blue-500 hover:bg-blue-500/90 text-white', dotColor: 'bg-blue-500' },
  en_livraison: { label: 'En livraison', className: 'bg-amber-500/10 text-amber-600 border border-amber-500/20', buttonClassName: 'bg-amber-500 hover:bg-amber-500/90 text-white', dotColor: 'bg-amber-500' },
  shipped: { label: 'Expédié', className: 'bg-blue-500/10 text-blue-600 border border-blue-500/20', buttonClassName: 'bg-blue-500 hover:bg-blue-500/90 text-white', dotColor: 'bg-blue-600' },
  delivered: { label: 'Livré', className: 'bg-success/20 text-success border border-success/30', buttonClassName: 'bg-success hover:bg-success/90 text-white', dotColor: 'bg-green-600' },
  erreur: { label: 'erreur', className: 'bg-red-500/10 text-red-600 border border-red-500/20', buttonClassName: 'bg-red-500 hover:bg-red-500/90 text-white', dotColor: 'bg-red-500' },
  'Échec_de_livraison': { label: 'Échec de livr', className: 'bg-red-500/10 text-red-600 border border-red-500/20', buttonClassName: 'bg-red-500 hover:bg-red-500/90 text-white', dotColor: 'bg-red-500' },
  exchange: { label: 'Échange', className: 'bg-purple-500/10 text-purple-600 border border-purple-500/20', buttonClassName: 'bg-purple-500 hover:bg-purple-500/90 text-white', dotColor: 'bg-purple-500' },
  alerte: { label: 'Alerte', className: 'bg-orange-500/10 text-orange-600 border border-orange-500/20', buttonClassName: 'bg-orange-500 hover:bg-orange-500/90 text-white', dotColor: 'bg-orange-500' },
  delivered_paid: { label: 'Livré Payé', className: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20', buttonClassName: 'bg-emerald-500 hover:bg-emerald-500/90 text-white', dotColor: 'bg-emerald-600' },
  returned: { label: 'Retourné', className: 'bg-destructive/10 text-destructive border border-destructive/20', buttonClassName: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground', dotColor: 'bg-red-600' },
};

export const OrderStatusBadge = forwardRef<HTMLSpanElement, OrderStatusBadgeProps>(
  ({ status, className, ...rest }, ref) => {
    const config = statusConfig[status];
    const prevStatusRef = useRef<OrderStatus>(status);
    const isFirstRenderRef = useRef(true);
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
        prevStatusRef.current = status;
        return;
      }
      if (prevStatusRef.current !== status) {
        prevStatusRef.current = status;
        setAnimate(false);
        // force a reflow tick before re-applying class so animation always replays
        const raf = requestAnimationFrame(() => setAnimate(true));
        const t = setTimeout(() => setAnimate(false), 950);
        return () => {
          cancelAnimationFrame(raf);
          clearTimeout(t);
        };
      }
    }, [status]);

    return (
      <span
        ref={ref}
        {...rest}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors',
          config.className,
          animate && 'animate-status-change animate-status-glow',
          className
        )}
      >
        {config.label}
      </span>
    );
  }
);
OrderStatusBadge.displayName = 'OrderStatusBadge';

export const allOrderStatuses = Object.entries(statusConfig).map(([value, config]) => ({
  value: value as OrderStatus,
  label: config.label,
  dotColor: config.dotColor,
}));

export function getStatusButtonClassName(status: OrderStatus): string {
  return statusConfig[status]?.buttonClassName || 'bg-primary hover:bg-primary/90 text-primary-foreground';
}
