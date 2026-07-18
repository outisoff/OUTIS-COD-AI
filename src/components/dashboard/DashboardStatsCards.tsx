import { useState } from 'react';
import { ShoppingCart, Timer, CheckCircle, Ban, Package, Truck, PackageCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusOrdersDialog } from './StatusOrdersDialog';
import type { OrderWithItems } from '@/hooks/useOrders';

const SUB_STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  validated: 'Validé',
  failed_1: 'Échoué 1 (D-1)',
  failed_2: 'Échoué 2 (D-1)',
  failed_3: 'Échoué 3 (D-1)',
  failed_4: 'Échoué 1 (D-2)',
  failed_5: 'Échoué 2 (D-2)',
  failed_6: 'Échoué 3 (D-2)',
  postponed: 'Reporté',
  to_reconfirm: 'À reconfirmer',
  callback: 'Me rappeler',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  wrong_number: 'Faux numéro',
  out_of_stock: 'Fin de stock',
  no_answer: 'Répondre pas',
  duplicate: 'Dupliquer',
  preparing: 'En préparation',
  ready: 'Prêt',
  shipped: 'Expédié',
  to_station: 'Vers station',
  at_station: 'En station',
  au_bureau: 'Au bureau',
  en_livraison: 'En livraison',
  delivered: 'Livré (Non Payé)',
  encaisse: 'Encaissé',
  delivered_paid: 'Payé',
  'Échec_de_livraison': 'Échec livraison',
  returned: 'Retourné',
  erreur: 'Erreur',
};

const CARD_CONFIGS = [
  {
    id: 'total', label: 'Reçues', icon: ShoppingCart, statKey: 'totalToday' as const,
    card: 'bg-gradient-to-b from-muted/60 to-muted/30 border-border/50',
    iconBg: 'bg-primary/15', iconText: 'text-primary', valueText: '',
    subStatuses: [] as string[],
  },
  {
    id: 'pending', label: 'En Attente', icon: Timer, statKey: 'pendingConfirmations' as const,
    card: 'bg-gradient-to-b from-orange-50 to-orange-100/40 dark:from-orange-500/15 dark:to-orange-500/5 border-orange-200/50 dark:border-orange-500/20',
    iconBg: 'bg-orange-100 dark:bg-orange-500/25', iconText: 'text-orange-500', valueText: 'text-orange-500',
    subStatuses: ['new', 'echoue', 'reporte', 'erreur'],
  },
  {
    id: 'confirmed', label: 'Confirmées', icon: CheckCircle, statKey: 'confirmedToday' as const,
    card: 'bg-gradient-to-b from-green-50 to-green-100/40 dark:from-green-500/15 dark:to-green-500/5 border-green-200/50 dark:border-green-500/20',
    iconBg: 'bg-green-100 dark:bg-green-500/25', iconText: 'text-green-600', valueText: 'text-green-600',
    subStatuses: ['confirmed', 'validated'],
  },
  {
    id: 'cancelled', label: 'Annulées', icon: Ban, statKey: 'cancelledToday' as const,
    card: 'bg-gradient-to-b from-red-50 to-red-100/40 dark:from-red-500/15 dark:to-red-500/5 border-red-200/50 dark:border-red-500/20',
    iconBg: 'bg-red-100 dark:bg-red-500/25', iconText: 'text-red-500', valueText: 'text-red-500',
    subStatuses: ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'],
  },
  {
    id: 'preparing', label: 'Préparation', icon: Package, statKey: 'preparingToday' as const,
    card: 'bg-gradient-to-b from-blue-50 to-blue-100/40 dark:from-blue-500/15 dark:to-blue-500/5 border-blue-200/50 dark:border-blue-500/20',
    iconBg: 'bg-blue-100 dark:bg-blue-500/25', iconText: 'text-blue-500', valueText: 'text-blue-500',
    subStatuses: ['preparing', 'ready'],
  },
  {
    id: 'shipped', label: 'Expédié', icon: Truck, statKey: 'shippedToday' as const,
    card: 'bg-gradient-to-b from-purple-50 to-purple-100/40 dark:from-purple-500/15 dark:to-purple-500/5 border-purple-200/50 dark:border-purple-500/20',
    iconBg: 'bg-purple-100 dark:bg-purple-500/25', iconText: 'text-purple-500', valueText: 'text-purple-500',
    subStatuses: ['to_station', 'at_station', 'au_bureau', 'en_livraison'],
  },
  {
    id: 'delivered', label: 'Livré', icon: PackageCheck, statKey: 'deliveredToday' as const,
    card: 'bg-gradient-to-b from-emerald-50 to-emerald-100/40 dark:from-emerald-500/15 dark:to-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/25', iconText: 'text-emerald-600', valueText: 'text-emerald-600',
    subStatuses: ['delivered', 'delivered_paid'],
  },
  {
    id: 'return', label: 'Retour', icon: AlertTriangle, statKey: 'echecToday' as const,
    card: 'bg-gradient-to-b from-red-50 to-red-100/40 dark:from-red-500/15 dark:to-red-500/5 border-red-200/50 dark:border-red-500/20',
    iconBg: 'bg-red-100 dark:bg-red-500/25', iconText: 'text-red-500', valueText: 'text-red-500',
    subStatuses: ['Échec_de_livraison', 'returned'],
  },
];

// Map sub-status keys to their actual DB statuses for querying
const STATUS_DB_MAP: Record<string, string[]> = {
  echoue: ['failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6'],
  reporte: ['postponed', 'to_reconfirm', 'callback'],
  delivered: ['delivered'],
};

// Map sub-status key to the order date field to filter by within selected period
const STATUS_DATE_FIELD: Record<string, keyof OrderWithItems> = {
  delivered: 'delivered_at' as keyof OrderWithItems,
  delivered_paid: 'delivered_at' as keyof OrderWithItems,
};

interface DashboardStatsCardsProps {
  orderStats: {
    totalToday: number;
    pendingConfirmations: number;
    confirmedToday: number;
    cancelledToday: number;
    preparingToday: number;
    shippedToday: number;
    deliveredToday: number;
    echecToday: number;
    ordersByStatus: { status: string; count: number }[];
    ordersByStatusCreated?: { status: string; count: number }[];
  } | undefined;
  orders?: OrderWithItems[];
  dateRange?: { from?: Date; to?: Date };
}

export function DashboardStatsCards({ orderStats, orders, dateRange }: DashboardStatsCardsProps) {
  const [drillDown, setDrillDown] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogStatuses, setDialogStatuses] = useState<string[]>([]);
  const [dialogDateField, setDialogDateField] = useState<keyof OrderWithItems | undefined>(undefined);

  const statusCountMap = new Map<string, number>();
  orderStats?.ordersByStatus?.forEach(s => statusCountMap.set(s.status, s.count));

  // Grouped sub-statuses
  const GROUPED_STATUSES: Record<string, { label: string; keys: string[] }> = {
    echoue: { label: 'Échoué', keys: ['failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6'] },
    reporte: { label: 'Reporté', keys: ['postponed', 'to_reconfirm', 'callback'] },
  };

  const getSubCount = (key: string): number => {
    const group = GROUPED_STATUSES[key];
    if (group) return group.keys.reduce((sum, k) => sum + (statusCountMap.get(k) || 0), 0);
    return statusCountMap.get(key) || 0;
  };

  const getSubLabel = (key: string): string => {
    const group = GROUPED_STATUSES[key];
    if (group) return group.label;
    return SUB_STATUS_LABELS[key] || key;
  };

  const handleCardClick = (cardId: string) => {
    const config = CARD_CONFIGS.find(c => c.id === cardId);
    if (!config) return;
    if (cardId === 'total') return;
    if (config.subStatuses.length <= 1) return;
    setDrillDown(cardId);
  };


  const handleSubStatusClick = (key: string, label: string) => {
    const dbStatuses = STATUS_DB_MAP[key] || [key];
    setDialogTitle(label);
    setDialogStatuses(dbStatuses);
    setDialogDateField(STATUS_DATE_FIELD[key]);
    setDialogOpen(true);
  };

  const drillConfig = CARD_CONFIGS.find(c => c.id === drillDown);

  // Special drill-down for 'Reçues': show the 7 status group cards
  if (drillDown === 'total') {
    const TotalIcon = ShoppingCart;
    const groupCards = CARD_CONFIGS.filter(c => c.id !== 'total');

    // Cohort counts: orders CREATED in period, grouped by current status
    const createdMap = new Map<string, number>();
    orderStats?.ordersByStatusCreated?.forEach(s => createdMap.set(s.status, s.count));
    const getCohortCount = (card: typeof CARD_CONFIGS[number]) => {
      const dbStatuses = card.subStatuses.flatMap(k => STATUS_DB_MAP[k] || [k]);
      return dbStatuses.reduce((sum, s) => sum + (createdMap.get(s) || 0), 0);
    };
    const cohortTotal = Array.from(createdMap.values()).reduce((a, b) => a + b, 0);

    const handleGroupClick = (card: typeof CARD_CONFIGS[number]) => {
      // Expand grouped sub-status keys (echoue/reporte) to actual DB statuses
      const dbStatuses = card.subStatuses.flatMap(k => STATUS_DB_MAP[k] || [k]);
      setDialogTitle(`Reçues — ${card.label}`);
      setDialogStatuses(dbStatuses);
      setDialogDateField('created_at' as keyof OrderWithItems);
      setDialogOpen(true);
    };

    const handleAllClick = () => {
      setDialogTitle('Reçues — Toutes');
      setDialogStatuses([]);
      setDialogDateField('created_at' as keyof OrderWithItems);
      setDialogOpen(true);
    };

    return (
      <>
        <div className="stat-card flex flex-col gap-4 overflow-hidden animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrillDown(null)}
              className="p-2 rounded-xl hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="p-2 rounded-xl bg-primary/15">
              <TotalIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Reçues</p>
              <p className="text-xs text-muted-foreground">
                {cohortTotal} commande(s) créée(s) dans la période
              </p>
            </div>
            <button
              onClick={handleAllClick}
              className="text-xs font-semibold text-primary hover:underline px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
            >
              Voir toutes
            </button>
          </div>

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${groupCards.length}, minmax(0, 1fr))` }}
          >
            {groupCards.map((card) => {
              const Icon = card.icon;
              const value = getCohortCount(card);
              return (
                <div
                  key={card.id}
                  onClick={() => handleGroupClick(card)}
                  className={cn(
                    "flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-1",
                    card.card
                  )}
                >
                  <div className={cn("p-2.5 rounded-xl shadow-sm", card.iconBg)}>
                    <Icon className={cn("h-5 w-5", card.iconText)} />
                  </div>
                  <p className={cn("text-2xl font-extrabold tracking-tight", card.valueText)}>
                    {value}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider text-center leading-tight">
                    {card.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <StatusOrdersDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={dialogTitle}
          statuses={dialogStatuses}
          orders={orders}
          dateRange={dateRange}
          dateField={dialogDateField}
        />
      </>
    );
  }


  // Drill-down view: show sub-statuses as cards
  if (drillConfig) {
    const Icon = drillConfig.icon;
    const subCards = drillConfig.subStatuses.map(key => ({
      key,
      label: getSubLabel(key),
      count: getSubCount(key),
    }));

    return (
      <>
        <div className="stat-card flex flex-col gap-4 overflow-hidden animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrillDown(null)}
              className="p-2 rounded-xl hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className={cn("p-2 rounded-xl", drillConfig.iconBg)}>
              <Icon className={cn("h-5 w-5", drillConfig.iconText)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{drillConfig.label}</p>
              <p className="text-xs text-muted-foreground">
                {orderStats?.[drillConfig.statKey] || 0} commande(s) au total
              </p>
            </div>
          </div>

          <div className={cn(
            "grid gap-3",
            subCards.length <= 4 ? "grid-cols-4" : 
            subCards.length <= 6 ? "grid-cols-3 md:grid-cols-6" :
            "grid-cols-4 md:grid-cols-6 lg:grid-cols-" + Math.min(subCards.length, 8)
          )}
          style={{
            gridTemplateColumns: `repeat(${Math.min(subCards.length, 8)}, minmax(0, 1fr))`
          }}
          >
            {subCards.map((sub) => (
              <div
                key={sub.key}
                onClick={() => handleSubStatusClick(sub.key, sub.label)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-1",
                  drillConfig.card
                )}
              >
                <p className={cn("text-2xl font-extrabold tracking-tight", drillConfig.valueText)}>
                  {sub.count}
                </p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider text-center leading-tight">
                  {(() => {
                    const m = sub.label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
                    if (!m) return sub.label;
                    return (<>{m[1]} <span className="text-[9.5px] normal-case opacity-80">({m[2]})</span></>);
                  })()}
                </p>
              </div>
            ))}
          </div>
        </div>

        <StatusOrdersDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={dialogTitle}
          statuses={dialogStatuses}
          orders={orders}
          dateRange={dateRange}
          dateField={dialogDateField}
        />
      </>
    );
  }

  // Default view: main stat cards
  return (
    <>
      <div className="stat-card flex flex-col justify-between overflow-hidden">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
          {CARD_CONFIGS.map((card) => {
            const Icon = card.icon;
            const isClickable = card.subStatuses.length > 1 && card.id !== 'total';
            const value = orderStats?.[card.statKey] || 0;

            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className={cn(
                  "flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
                  card.card,
                  isClickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                <div className={cn("p-2.5 rounded-xl shadow-sm", card.iconBg)}>
                  <Icon className={cn("h-5 w-5", card.iconText)} />
                </div>
                <p className={cn("text-2xl font-extrabold tracking-tight", card.valueText)}>
                  {value}
                </p>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  {card.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <StatusOrdersDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        statuses={dialogStatuses}
        orders={orders}
        dateRange={dateRange}
        dateField={dialogDateField}
      />
    </>
  );
}
