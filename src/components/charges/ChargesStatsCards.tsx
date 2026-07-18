import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Receipt, Megaphone, Users, Laptop, Package, LayoutGrid, Warehouse } from 'lucide-react';
import type { Charge } from '@/hooks/useCharges';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getChargeAccruedAmount, getChargeOccurrences } from '@/lib/chargeCalculations';

const formatNumber = (v: number) => new Intl.NumberFormat('fr-DZ').format(Math.round(v));
const formatCurrency = (v: number) => new Intl.NumberFormat('fr-DZ').format(v) + ' DA';

interface Props {
  charges: Charge[];
  perOrderResolver?: (c: Charge) => number;
  dateFrom?: Date;
  dateTo?: Date;
}

const categoryConfig = [
  {
    key: 'marketing', label: 'Marketing', icon: Megaphone,
    matches: ['marketing', 'advertising', 'publicité', 'pub'],
    card: 'bg-card border-border',
    iconBg: 'bg-chart-2/10', iconText: 'text-chart-2', valueText: 'text-foreground',
  },
  {
    key: 'hr', label: 'Ressources Humaines', icon: Users,
    matches: ['hr', 'rh', 'salaries', 'salaire', 'ressources'],
    card: 'bg-card border-border',
    iconBg: 'bg-chart-5/10', iconText: 'text-chart-5', valueText: 'text-foreground',
  },
  {
    key: 'it', label: 'IT / Logiciels', icon: Laptop,
    matches: ['it', 'tools', 'logiciel', 'software'],
    card: 'bg-card border-border',
    iconBg: 'bg-chart-1/10', iconText: 'text-chart-1', valueText: 'text-foreground',
  },
  {
    key: 'packaging', label: 'Emballage', icon: Package,
    matches: ['packaging', 'emballage'],
    card: 'bg-card border-border',
    iconBg: 'bg-chart-3/10', iconText: 'text-chart-3', valueText: 'text-foreground',
  },
  {
    key: 'warehouse', label: 'Entrepôt', icon: Warehouse,
    matches: ['warehouse', 'entrepôt', 'entrepot', 'stock', 'storage'],
    card: 'bg-card border-border',
    iconBg: 'bg-chart-6/10', iconText: 'text-chart-6', valueText: 'text-foreground',
  },
  {
    key: 'other', label: 'Diverses', icon: LayoutGrid,
    matches: ['other', 'divers', 'autre'],
    card: 'bg-card border-border',
    iconBg: 'bg-muted', iconText: 'text-muted-foreground', valueText: 'text-foreground',
  },
];

export default function ChargesStatsCards({ charges, perOrderResolver, dateFrom, dateTo }: Props) {
  // Compute accrued amount per charge within the selected date range
  const accruedByCharge = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of charges) map.set(c.id, getChargeAccruedAmount(c, dateFrom, dateTo, perOrderResolver));
    return map;
  }, [charges, perOrderResolver, dateFrom, dateTo]);

  const total = charges.reduce((s, c) => s + (accruedByCharge.get(c.id) ?? Number(c.amount)), 0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const categoryTotals = categoryConfig.map(cfg => {
    const list = charges.filter(c => cfg.matches.some(m => c.category.toLowerCase().includes(m)));
    const sum = list.reduce((s, c) => s + (accruedByCharge.get(c.id) ?? Number(c.amount)), 0);
    return { ...cfg, sum, list };
  });

  const selected = useMemo(
    () => categoryTotals.find(c => c.key === selectedKey) || null,
    [selectedKey, categoryTotals]
  );

  // Group selected category charges by subcategory
  const grouped = useMemo(() => {
    if (!selected) return [] as { name: string; total: number; items: Charge[] }[];
    const map = new Map<string, { name: string; total: number; items: Charge[] }>();
    for (const c of selected.list) {
      const key = c.subcategory?.trim() || 'Sans sous-catégorie';
      const entry = map.get(key) || { name: key, total: 0, items: [] };
      entry.total += accruedByCharge.get(c.id) ?? Number(c.amount);
      entry.items.push(c);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [selected, accruedByCharge]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total card - primary highlighted */}
        <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide uppercase opacity-90 truncate">Total des charges</p>
              <p className="mt-2 text-2xl font-bold leading-none truncate">
                {formatNumber(total)}
              </p>
              <p className="mt-1 text-[10px] font-medium opacity-80">DZD</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Category cards - clickable */}
        {categoryTotals.map(c => (
          <button
            type="button"
            key={c.key}
            onClick={() => setSelectedKey(c.key)}
            className={cn(
              'text-left rounded-lg border p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/40',
              c.card
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground truncate">{c.label}</p>
                <p className={cn('mt-2 text-2xl font-bold leading-none truncate', c.valueText)}>
                  {formatNumber(c.sum)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">DZD</p>
              </div>
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', c.iconBg)}>
                <c.icon className={cn('h-4 w-4', c.iconText)} />
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedKey(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && <selected.icon className={cn('h-5 w-5', selected.iconText)} />}
              {selected?.label} — {selected ? formatCurrency(selected.sum) : ''}
            </DialogTitle>
          </DialogHeader>
          {selected && selected.list.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">
              Aucune charge dans cette catégorie
            </p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {grouped.map(g => (
                <div key={g.name} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                    <span className="text-sm font-semibold">{g.name}</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(g.total)}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map(it => {
                        const occ = getChargeOccurrences(it, dateFrom, dateTo, perOrderResolver);
                        const accrued = accruedByCharge.get(it.id) ?? Number(it.amount);
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="font-medium">
                              {it.name}
                              {occ > 1 && (
                                <span className="ml-1 text-xs text-muted-foreground">({(Math.round(occ * 100) / 100).toLocaleString('fr-FR')}× × {formatCurrency(Number(it.amount))})</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                              {format(new Date(it.charge_date), 'd MMM yyyy', { locale: fr })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(accrued)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
