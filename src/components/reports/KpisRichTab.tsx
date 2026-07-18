import { useState } from 'react';
import {
  TrendingUp, DollarSign, Coins, Percent, Package, Receipt, Truck, RotateCcw, Users,
  ShoppingCart, ClipboardList, UserCheck, Wallet, Scale, Megaphone, type LucideIcon,
} from 'lucide-react';
import { useReportStatsCompare, type ComparePeriod, type KpiSnapshot } from '@/hooks/useReportStatsCompare';
import { type Tone } from './KpiCardRich';
import { KpiRowItem } from './KpiRowItem';
import { ChargesDetailDialog } from './ChargesDetailDialog';
import { RevenueDetailDialog } from './RevenueDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v));
const formatNumber = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v));
const formatPercent = (v: number) => `${Math.round(v)}%`;

const COMPARE_LABELS: Record<ComparePeriod, string> = {
  day:   'période préc.',
  week:  'semaine préc.',
  month: 'mois préc.',
  year:  'année préc.',
};

type DetailKey = 'rev' | 'net' | 'profit' | 'cogs' | 'dfees' | 'rfees' | 'tcosts' | 'dgap';

interface KpiDef {
  key: string;
  label: string;
  icon?: LucideIcon;
  tone?: Tone;
  pick: (s: KpiSnapshot) => number;
  format: (v: number) => string;
  suffix?: string;
  showDelta?: boolean;
  invertTrend?: boolean;
  detailKey?: DetailKey | 'charges';
  /** Optional secondary value rendered after main value, e.g. previous in parens */
  secondary?: (s: KpiSnapshot) => string;
}

interface PanelDef {
  title: string;
  icon: LucideIcon;
  kpis: KpiDef[];
}

const PANELS: PanelDef[] = [
  {
    title: 'Revenus & Profits',
    icon: Wallet,
    kpis: [
      { key: 'rev',     label: 'Ventes',                       icon: DollarSign,  tone: 'primary', pick: s => s.totalRevenue, format: formatCurrency, suffix: '(DZD)', detailKey: 'rev' },
      { key: 'net',     label: 'Revenus',                      icon: TrendingUp,  tone: 'success', pick: s => s.netRevenue,   format: formatCurrency, suffix: '(DZD)', detailKey: 'net' },
      { key: 'profit',  label: 'Bénéfices',                    icon: Coins,       tone: 'success', pick: s => s.profit,       format: formatCurrency, suffix: '(DZD)', showDelta: true, detailKey: 'profit' },
    ],
  },
  {
    title: 'Dépenses & Frais',
    icon: Scale,
    kpis: [
      { key: 'tcosts',  label: 'Coûts totaux',      icon: Coins,    tone: 'warning',     pick: s => s.totalCosts,        format: formatCurrency, suffix: '(DZD)', invertTrend: true, detailKey: 'tcosts' },
      { key: 'cogs',    label: 'Coût des Produits', icon: Package,  tone: 'warning',     pick: s => s.totalCOGS,         format: formatCurrency, suffix: '(DZD)', invertTrend: true, detailKey: 'cogs' },
      { key: 'charges', label: 'Charges',           icon: Receipt,  tone: 'warning',     pick: s => s.totalCharges,      format: formatCurrency, suffix: '(DZD)', invertTrend: true, detailKey: 'charges' },
    ],
  },
  {
    title: 'Impact de Livraison',
    icon: Truck,
    kpis: [
      {
        key: 'dgap', label: 'Total frais société de livraison', icon: Truck, tone: 'warning',
        pick: s => (s.totalDeliveryFees + s.totalReturnFees),
        format: formatCurrency, suffix: '(DZD)', invertTrend: true, detailKey: 'dgap',
        secondary: s => {
          const v = s.totalDeliveredOrders > 0
            ? (s.totalDeliveryFees + s.totalReturnFees) / s.totalDeliveredOrders
            : 0;
          return `${formatCurrency(v)} DZD / Livré`;
        },
      },
      { key: 'dfees',   label: 'Frais de livraison', icon: Truck,    tone: 'warning',     pick: s => s.totalDeliveryFees, format: formatCurrency, suffix: '(DZD)', invertTrend: true, detailKey: 'dfees' },
      { key: 'rfees',   label: 'Frais de retour',   icon: RotateCcw, tone: 'destructive', pick: s => s.totalReturnFees,   format: formatCurrency, suffix: '(DZD)', invertTrend: true, detailKey: 'rfees' },
    ],
  },
  {
    title: 'Métriques Clients',
    icon: Users,
    kpis: [],
  },
];

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
  storeId?: string | null;
}

export function KpisRichTab({ dateFrom, dateTo, storeId }: Props) {
  const [comparePeriod] = useState<ComparePeriod>('day');
  const [chargesOpen, setChargesOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<DetailKey | null>(null);
  const { data, isLoading } = useReportStatsCompare(dateFrom, dateTo, storeId, comparePeriod);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[320px] rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left side: 4 KPI panels in 2x2 (takes 2/3 width) */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          {PANELS.map(panel => {
            const Icon = panel.icon;
            return (
              <section
                key={panel.title}
                className="bg-card rounded-xl border border-border overflow-hidden flex flex-col shadow-sm"
              >
                {/* Header */}
                <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">{panel.title}</h2>
                </header>

                {/* Rows */}
                <div className="flex-1 p-3 space-y-2">
                  {panel.kpis.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[160px]">
                      <p className="text-xs text-muted-foreground/70 italic">À venir…</p>
                    </div>
                  ) : panel.kpis.map(kpi => {
                    const raw = kpi.pick(data.current);
                    const prev = kpi.pick(data.previous);
                    let tone = kpi.tone;
                    if (kpi.key === 'profit' || kpi.key === 'margin' || kpi.key === 'roi') {
                      tone = raw >= 0 ? 'success' : 'destructive';
                    }
                    const onClick =
                      kpi.detailKey === 'charges' ? () => setChargesOpen(true)
                      : kpi.detailKey ? () => setDetailKey(kpi.detailKey as DetailKey)
                      : undefined;

                    return (
                      <KpiRowItem
                        key={kpi.key}
                        icon={kpi.icon}
                        label={kpi.label}
                        value={kpi.format(raw)}
                        rawValue={raw}
                        previousValue={prev}
                        formatValue={kpi.format}
                        tone={tone}
                        invertTrend={kpi.invertTrend}
                        showDelta={kpi.showDelta}
                        suffix={kpi.suffix}
                        secondaryLabel={kpi.secondary ? '' : undefined}
                        secondaryValue={kpi.secondary ? kpi.secondary(data.current) : undefined}
                        onClick={onClick}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right column: Performance — key buyer & order indicators */}
        <aside className="bg-card rounded-xl border border-border overflow-hidden flex flex-col min-h-[320px] shadow-sm">
          <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Performance</h2>
          </header>
          <div className="flex-1 p-3 space-y-2">
            {([
              { key: 'p_buyers',    label: 'Acheteurs',                              icon: UserCheck,    tone: 'primary' as Tone, pick: (s: KpiSnapshot) => s.uniqueBuyers,         format: formatNumber },
              { key: 'p_delivered', label: 'Total commandes (livré)',                icon: ShoppingCart, tone: 'primary' as Tone, pick: (s: KpiSnapshot) => s.totalDeliveredOrders, format: formatNumber },
              { key: 'p_products',  label: 'Total produits (livré)',                 icon: Package,      tone: 'primary' as Tone, pick: (s: KpiSnapshot) => s.totalProductsInOrders, format: formatNumber },
              { key: 'p_aov',       label: 'Valeur moyenne par commande (AOV)',      icon: ClipboardList, tone: 'primary' as Tone, pick: (s: KpiSnapshot) => s.aov, format: formatCurrency, suffix: '(DZD)' },
              { key: 'p_pov',       label: 'Valeur du profit par commande (POV)',    icon: Coins,        tone: 'success' as Tone, pick: (s: KpiSnapshot) => s.pov, format: formatCurrency, suffix: '(DZD)' },
              { key: 'p_acv',       label: "Valeur moyenne de l'acheteur (ACV)",     icon: Users,        tone: 'primary' as Tone, pick: (s: KpiSnapshot) => s.acv, format: formatCurrency, suffix: '(DZD)' },
              { key: 'p_pcv',       label: 'Valeur de profit par acheteur (PCV)',    icon: Wallet,       tone: 'success' as Tone, pick: (s: KpiSnapshot) => s.pcv, format: formatCurrency, suffix: '(DZD)' },
              { key: 'p_roi',       label: 'Retour sur investissement (ROI)',        icon: Percent,      tone: 'success' as Tone, pick: (s: KpiSnapshot) => s.roi, format: formatPercent },
              { key: 'p_margin',    label: 'Marge bénéficiaire',                     icon: Percent,      tone: 'success' as Tone, pick: (s: KpiSnapshot) => s.profitMargin, format: formatPercent },
              { key: 'p_upsell',    label: 'Upsell',                                 icon: Megaphone,    tone: 'success' as Tone, pick: (s: KpiSnapshot) => s.upsellCount,  format: formatNumber },
            ]).map(kpi => {
              const raw = kpi.pick(data.current);
              const prev = kpi.pick(data.previous);
              let tone = kpi.tone;
              if (kpi.key === 'p_roi' || kpi.key === 'p_margin') tone = raw >= 0 ? 'success' : 'destructive';
              return (
                <KpiRowItem
                  key={kpi.key}
                  icon={kpi.icon}
                  label={kpi.label}
                  value={kpi.format(raw)}
                  rawValue={raw}
                  previousValue={prev}
                  formatValue={kpi.format}
                  tone={tone}
                  suffix={kpi.suffix}
                />
              );
            })}
          </div>
        </aside>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Comparaison vs {COMPARE_LABELS[comparePeriod]}
      </p>

      {data && (
        <ChargesDetailDialog
          open={chargesOpen}
          onOpenChange={setChargesOpen}
          totalCharges={data.current.totalCharges}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'rev'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail des ventes"
          description="Chiffre d'affaires brut sur les commandes livrées."
          headerIcon={DollarSign}
          headerIconColor="text-primary"
          totalValue={data.current.totalRevenue}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            {
              icon: DollarSign, iconBg: 'bg-primary/10', iconColor: 'text-primary',
              label: 'Ventes totales (brut)',
              hint: 'Somme des prix de vente des commandes livrées',
              value: data.current.totalRevenue, isTotal: true,
            },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'net'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail des revenus nets"
          description="Ventes brutes moins les frais de logistique (livraison + retour)."
          headerIcon={TrendingUp}
          headerIconColor="text-success"
          totalValue={data.current.netRevenue}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: DollarSign, iconBg: 'bg-primary/10', iconColor: 'text-primary',
              label: 'Ventes (brut)', hint: "Chiffre d'affaires des commandes livrées",
              value: data.current.totalRevenue },
            { icon: Truck, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Frais de livraison', hint: 'Coût réel de livraison',
              value: data.current.totalDeliveryFees, isNegative: true },
            { icon: RotateCcw, iconBg: 'bg-destructive/10', iconColor: 'text-destructive',
              label: 'Frais de retour', hint: 'Coût des commandes retournées',
              value: data.current.totalReturnFees, isNegative: true },
            { icon: TrendingUp, iconBg: 'bg-success/10', iconColor: 'text-success',
              label: 'Revenus nets', hint: 'Ventes − Livraison − Retours',
              value: data.current.netRevenue, isTotal: true },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'profit'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail des bénéfices"
          description="Revenus nets moins le coût des produits et les charges."
          headerIcon={Coins}
          headerIconColor="text-success"
          totalValue={data.current.profit}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: TrendingUp, iconBg: 'bg-success/10', iconColor: 'text-success',
              label: 'Revenus nets', hint: 'Ventes − Livraison − Retours',
              value: data.current.netRevenue },
            { icon: Package, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Coût des produits (COGS)', hint: "Prix d'achat des produits livrés",
              value: data.current.totalCOGS, isNegative: true },
            { icon: Receipt, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Charges', hint: 'Marketing, salaires, loyer, etc.',
              value: data.current.totalCharges, isNegative: true },
            { icon: Coins, iconBg: 'bg-success/10', iconColor: 'text-success',
              label: 'Bénéfices', hint: 'Revenus nets − COGS − Charges',
              value: data.current.profit, isTotal: true },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'cogs'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail du coût des produits"
          description="Prix d'achat total des produits livrés (COGS)."
          headerIcon={Package}
          headerIconColor="text-warning"
          totalValue={data.current.totalCOGS}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: Package, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Coût des produits (COGS)',
              hint: "Somme des prix d'achat des produits livrés",
              value: data.current.totalCOGS, isTotal: true },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'dfees'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail des frais de livraison"
          description="Coût réel total de livraison des commandes livrées."
          headerIcon={Truck}
          headerIconColor="text-warning"
          totalValue={data.current.totalDeliveryFees}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: Truck, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Frais de livraison',
              hint: 'Coût payé au transporteur pour les commandes livrées',
              value: data.current.totalDeliveryFees, isTotal: true },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'rfees'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail des frais de retour"
          description="Coût total des commandes retournées."
          headerIcon={RotateCcw}
          headerIconColor="text-destructive"
          totalValue={data.current.totalReturnFees}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: RotateCcw, iconBg: 'bg-destructive/10', iconColor: 'text-destructive',
              label: 'Frais de retour',
              hint: 'Coût payé au transporteur pour les commandes retournées',
              value: data.current.totalReturnFees, isTotal: true },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'tcosts'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Détail des coûts totaux"
          description="Somme du coût des produits et des charges."
          headerIcon={Coins}
          headerIconColor="text-warning"
          totalValue={data.current.totalCosts}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: Package, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Coût des produits (COGS)', hint: "Prix d'achat des produits livrés",
              value: data.current.totalCOGS },
            { icon: Receipt, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Charges', hint: 'Marketing, salaires, loyer, etc.',
              value: data.current.totalCharges },
            { icon: Coins, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Coûts totaux', hint: 'COGS + Charges',
              value: data.current.totalCosts, isTotal: true },
          ]}
        />
      )}

      {data && (
        <RevenueDetailDialog
          open={detailKey === 'dgap'}
          onOpenChange={(o) => !o && setDetailKey(null)}
          title="Total frais société de livraison"
          description="Somme des frais de livraison et des frais de retour."
          headerIcon={Truck}
          headerIconColor="text-warning"
          totalValue={data.current.totalDeliveryFees + data.current.totalReturnFees}
          totalDeliveredOrders={data.current.totalDeliveredOrders}
          totalProductsInOrders={data.current.totalProductsInOrders}
          rows={[
            { icon: Truck, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Frais de livraison',
              hint: 'Coût payé au transporteur pour les commandes livrées',
              value: data.current.totalDeliveryFees },
            { icon: RotateCcw, iconBg: 'bg-destructive/10', iconColor: 'text-destructive',
              label: 'Frais de retour',
              hint: 'Coût payé au transporteur pour les commandes retournées',
              value: data.current.totalReturnFees },
            { icon: Truck, iconBg: 'bg-warning/10', iconColor: 'text-warning',
              label: 'Total frais société de livraison',
              hint: 'Frais de livraison + Frais de retour',
              value: data.current.totalDeliveryFees + data.current.totalReturnFees, isTotal: true },
          ]}
        />
      )}
    </div>
  );
}
