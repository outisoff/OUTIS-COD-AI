import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, UserPlus, Copy, Package, CheckCircle, PhoneCall, Wrench, Truck, RotateCcw, TrendingUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomerOrderHistoryDialog, type OrderHistoryFilter } from '@/components/customers/CustomerOrderHistoryDialog';
import type { RiskLevel } from '@/hooks/useReturnRisk';

interface ReturnRiskBadgeProps {
  riskLevel: RiskLevel;
  returnRate?: number;
  totalOrders?: number;
  returnedOrders?: number;
  deliveryFailures?: number;
  deliveredOrders?: number;
  returnedCount?: number;
  inConfirmation?: number;
  inPreparation?: number;
  inDelivery?: number;
  cancelledOrders?: number;
  isDuplicate?: boolean;
  duplicateCount?: number;
  customerPhone?: string;
  customerName?: string;
}

const riskConfig: Record<RiskLevel, { label: string; className: string; icon: typeof ShieldCheck }> = {
  nouveau: {
    label: 'Nouveau client',
    className: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
    icon: UserPlus,
  },
  faible: {
    label: 'Risque Retour Faible',
    className: 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800',
    icon: ShieldCheck,
  },
  moyen: {
    label: 'Risque Retour Moyen',
    className: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800',
    icon: ShieldAlert,
  },
  'élevé': {
    label: 'Risque Retour Élevé',
    className: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
    icon: ShieldX,
  },
};

interface StatRowProps {
  icon: React.ElementType;
  label: string;
  value: number;
  colorClass: string;
  onClick?: () => void;
}

function StatRow({ icon: Icon, label, value, colorClass, onClick }: StatRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 py-0.5 w-full rounded px-1 -mx-1 hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <div className={`flex items-center justify-center w-5 h-5 rounded ${colorClass}`}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-muted-foreground text-xs flex-1 text-left">{label}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{value}</span>
    </button>
  );
}

export function ReturnRiskBadge({ riskLevel, returnRate, totalOrders, returnedOrders, deliveryFailures, deliveredOrders, returnedCount, inConfirmation, inPreparation, inDelivery, cancelledOrders, isDuplicate, duplicateCount, customerPhone, customerName }: ReturnRiskBadgeProps) {
  const config = riskConfig[riskLevel];
  const Icon = config.icon;
  const ratePercent = returnRate != null ? Math.round(returnRate * 100) : null;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<OrderHistoryFilter>('all');

  const openHistory = (filter: OrderHistoryFilter) => {
    if (!customerPhone) return;
    setHistoryFilter(filter);
    setHistoryOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${config.className}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="space-y-1">
            <p className={`font-semibold text-xs mb-2 flex items-center gap-1.5 ${config.className.includes('red') ? 'text-red-600' : config.className.includes('orange') ? 'text-orange-600' : config.className.includes('green') ? 'text-green-600' : 'text-blue-600'}`}>
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </p>

            {totalOrders != null && totalOrders > 0 && (
              <StatRow icon={Package} label="Total commandes" value={totalOrders} colorClass="text-foreground" onClick={() => openHistory('all')} />
            )}
            {inConfirmation != null && inConfirmation > 0 && (
              <StatRow icon={PhoneCall} label="En confirmation" value={inConfirmation} colorClass="text-blue-600" onClick={() => openHistory('confirmation')} />
            )}
            {returnedOrders != null && returnedOrders > 0 && (
              <StatRow icon={ShieldX} label="Échecs" value={returnedOrders} colorClass="text-destructive" onClick={() => openHistory('failed')} />
            )}
            {inPreparation != null && inPreparation > 0 && (
              <StatRow icon={Wrench} label="En préparation" value={inPreparation} colorClass="text-purple-600" onClick={() => openHistory('preparation')} />
            )}
            {inDelivery != null && inDelivery > 0 && (
              <StatRow icon={Truck} label="En livraison" value={inDelivery} colorClass="text-orange-600" onClick={() => openHistory('delivery')} />
            )}
            {deliveredOrders != null && deliveredOrders > 0 && (
              <StatRow icon={CheckCircle} label="Livrées" value={deliveredOrders} colorClass="text-green-600" onClick={() => openHistory('delivered')} />
            )}
            {returnedCount != null && returnedCount > 0 && (
              <StatRow icon={RotateCcw} label="Retours" value={returnedCount} colorClass="text-orange-600" onClick={() => openHistory('returned')} />
            )}

            {ratePercent != null && (
              <>
                <div className="border-t border-border my-1.5" />
                <div className="flex items-center gap-2 py-0.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded text-foreground">
                    <TrendingUp className="h-3 w-3" />
                  </div>
                  <span className="text-muted-foreground text-xs flex-1">Taux de retour</span>
                  <span className={`text-xs font-bold ${ratePercent >= 50 ? 'text-destructive' : ratePercent >= 20 ? 'text-orange-600' : 'text-green-600'}`}>{ratePercent}%</span>
                </div>
              </>
            )}

          </div>
        </PopoverContent>
      </Popover>
      {isDuplicate && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
              <Copy className="h-3 w-3" />
              Doublon ({duplicateCount})
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" side="bottom" align="start">
            <p className="text-xs">Ce client a <span className="font-semibold">{duplicateCount}</span> commandes actives en même temps</p>
          </PopoverContent>
        </Popover>
      )}

      {customerPhone && (
        <CustomerOrderHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          customerPhone={customerPhone}
          customerName={customerName || customerPhone}
          statusFilter={historyFilter}
        />
      )}
    </div>
  );
}
