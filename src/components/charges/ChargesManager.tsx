import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Pencil, Search, Download, X, Check, Settings2, ChevronDown } from 'lucide-react';
import { useCharges, useAddCharge, useDeleteCharge, useUpdateCharge, type Charge, type ChargeType, type ChargeFrequency } from '@/hooks/useCharges';
import { useChargeSubcategories, useAddChargeSubcategory, useDeleteChargeSubcategory } from '@/hooks/useChargeSubcategories';
import { useChargeCategories } from '@/hooks/useChargeCategories';
import { useStores } from '@/hooks/useStores';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';


import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ChargesStatsCards from './ChargesStatsCards';
import ManageCategoriesDialog from './ManageCategoriesDialog';
import { getChargeAccruedAmount, getChargeOccurrences } from '@/lib/chargeCalculations';
import { useChargeOrderCounts } from '@/hooks/useChargeOrderCounts';

const defaultCategories = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'hr', label: 'Ressources Humaines' },
  { value: 'it', label: 'IT / Logiciels' },
  { value: 'packaging', label: 'Emballage' },
  { value: 'warehouse', label: 'Entrepôt' },
  { value: 'other', label: 'Diverses' },
];

const formatCurrency = (v: number) => new Intl.NumberFormat('fr-DZ').format(v) + ' DA';

const frequencies: { value: ChargeFrequency; label: string }[] = [
  { value: 'one_time', label: 'Une fois' },
  { value: 'weekly', label: 'Par semaine' },
  { value: 'monthly', label: 'Par mois' },
  { value: 'yearly', label: 'Par année' },
  { value: 'per_order', label: 'Par commande' },
  { value: 'per_product', label: 'Par produit' },
];
const frequencyLabels: Record<ChargeFrequency, string> = Object.fromEntries(frequencies.map(f => [f.value, f.label])) as any;

interface ChargesManagerProps {
  dateFrom?: Date;
  dateTo?: Date;
  showFilters?: boolean;
  onShowFiltersChange?: (open: boolean) => void;
  onActiveFiltersCountChange?: (count: number) => void;
  manageOpen?: boolean;
  onManageOpenChange?: (open: boolean) => void;
  /** Which UI section to render. Defaults to 'all' for backwards compat. */
  view?: 'all' | 'stats' | 'tables';
}

interface FilterState {
  search: string;
  category: string;
  frequency: string;
  from: string;
  to: string;
  store: string;
  product: string;
}

const emptyFilters: FilterState = { search: '', category: 'all', frequency: 'all', from: '', to: '', store: 'all', product: 'all' };

const emptyForm = {
  name: '',
  amount: '',
  category: 'other',
  subcategory: '',
  charge_date: new Date().toISOString().split('T')[0],
  charge_date_to: '',
  is_recurring: false,
  frequency: 'one_time' as ChargeFrequency,
  notes: '',
  store_id: '',
  product_id: '',
  product_ids: [] as string[],
};

interface ChargesTableSectionProps {
  charges: Charge[];
  isLoading: boolean;
  type: ChargeType;
  filters: FilterState;
  categoryLabels: Record<string, string>;
  onEdit: (c: Charge) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  perOrderResolver?: (c: Charge) => number;
}

function ChargesTableSection({ charges, isLoading, type, filters, categoryLabels, onEdit, onDelete, onAdd, perOrderResolver }: ChargesTableSectionProps) {
  const filtered = useMemo(() => {
    return charges.filter(c => {
      if (c.charge_type !== type) return false;
      if (filters.category !== 'all' && c.category !== filters.category) return false;
      if (filters.frequency !== 'all' && (c.frequency || 'one_time') !== filters.frequency) return false;
      if (filters.store !== 'all' && (filters.store === 'none' ? !!c.store_id : c.store_id !== filters.store)) return false;
      if (filters.product !== 'all') {
        const linkedIds = c.product_ids && c.product_ids.length ? c.product_ids : (c.product_id ? [c.product_id] : []);
        if (filters.product === 'none' ? linkedIds.length > 0 : !linkedIds.includes(filters.product)) return false;
      }
      if (filters.from && c.charge_date < filters.from) return false;
      if (filters.to && c.charge_date > filters.to) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hit = c.name.toLowerCase().includes(q) || (c.notes?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });
  }, [charges, filters, type]);

  // Date range used for accrual calculation: filter dates take priority,
  // otherwise we accrue from charge start to today.
  const rangeFrom = filters.from ? new Date(filters.from + 'T00:00:00') : undefined;
  const rangeTo = filters.to ? new Date(filters.to + 'T23:59:59') : undefined;

  const enriched = useMemo(() => filtered.map(c => {
    const occurrences = getChargeOccurrences(c, rangeFrom, rangeTo, perOrderResolver);
    const accrued = Number(c.amount) * occurrences;
    return { charge: c, occurrences, accrued };
  }), [filtered, rangeFrom?.getTime(), rangeTo?.getTime(), perOrderResolver]);

  const totalCharges = enriched.reduce((s, e) => s + e.accrued, 0);

  const handleExport = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Charges');
      ws.columns = [
        { header: 'Nom', key: 'name', width: 30 },
        { header: 'Catégorie', key: 'category', width: 18 },
        { header: 'Fréquence', key: 'frequency', width: 14 },
        { header: 'Date début', key: 'date', width: 14 },
        { header: 'Montant unitaire (DA)', key: 'unit', width: 18 },
        { header: 'Occurrences', key: 'occ', width: 12 },
        { header: 'Total (DA)', key: 'amount', width: 16 },
        { header: 'Notes', key: 'notes', width: 40 },
      ];
      ws.getRow(1).font = { bold: true };
      enriched.forEach(({ charge: c, occurrences, accrued }) => ws.addRow({
        name: c.name,
        category: categoryLabels[c.category] || c.category,
        frequency: frequencyLabels[c.frequency] || 'Une fois',
        date: c.charge_date,
        unit: Number(c.amount),
        occ: occurrences,
        amount: accrued,
        notes: c.notes || '',
      }));
      ws.addRow({});
      const totalRow = ws.addRow({ name: 'TOTAL', amount: totalCharges });
      totalRow.font = { bold: true };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charges-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export terminé');
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export");
    }
  };

  const title = type === 'fixe' ? 'Charges Fixes' : 'Charges Récurrentes';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">{title} — {formatCurrency(totalCharges)}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button size="sm" className="gap-1" onClick={onAdd}>
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-4">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucune charge</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                {type === 'fixe' && <TableHead>Fréquence</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant unitaire</TableHead>
                <TableHead className="text-right">Total accumulé</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {enriched.map(({ charge: c, occurrences, accrued }) => {
                const isRecurring = (c.frequency && c.frequency !== 'one_time' && c.frequency !== 'per_order' && c.frequency !== 'per_product') || c.is_recurring;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}{c.is_recurring && <span className="ml-1 text-xs text-muted-foreground">🔁</span>}</TableCell>
                    <TableCell>{categoryLabels[c.category] || c.category}</TableCell>
                    {type === 'fixe' && (
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                          {frequencyLabels[c.frequency] || 'Une fois'}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(c.charge_date), 'd MMM yyyy', { locale: fr })}
                      {c.charge_date_to && (
                        <span className="text-muted-foreground"> → {format(new Date(c.charge_date_to), 'd MMM yyyy', { locale: fr })}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.amount))}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(accrued)}
                      {isRecurring && occurrences > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          ({occurrences}×)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChargesManager({ dateFrom, dateTo, showFilters: showFiltersProp, onShowFiltersChange, onActiveFiltersCountChange, manageOpen: manageOpenProp, onManageOpenChange, view = 'all' }: ChargesManagerProps) {
  const { data: charges = [], isLoading } = useCharges(dateFrom, dateTo);
  const addCharge = useAddCharge();
  const updateCharge = useUpdateCharge();
  const deleteCharge = useDeleteCharge();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<Charge | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<ChargeType>('fixe');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [manageOpenInternal, setManageOpenInternal] = useState(false);
  const manageOpen = manageOpenProp ?? manageOpenInternal;
  const setManageOpen = onManageOpenChange ?? setManageOpenInternal;
  // Amount-change confirmation flow (Option A: period of validity)
  const [amountChangeOpen, setAmountChangeOpen] = useState(false);
  const [amountEffectiveDate, setAmountEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { data: subcategories = [] } = useChargeSubcategories();
  const addSubcategory = useAddChargeSubcategory();
  const deleteSubcategory = useDeleteChargeSubcategory();
  const { data: customCategories = [] } = useChargeCategories();
  const { data: stores = [] } = useStores();
  const { data: products = [] } = useProducts();
  const { data: orderCounts } = useChargeOrderCounts(dateFrom, dateTo);
  const perOrderResolver = useMemo(
    () => (c: Charge) => orderCounts?.getCountForCharge(c) ?? 0,
    [orderCounts]
  );
  const categories = useMemo(() => {
    const customMapped = customCategories.map(c => ({ value: c.value, label: c.label }));
    return [...defaultCategories, ...customMapped];
  }, [customCategories]);
  const categoryLabels = useMemo<Record<string, string>>(
    () => Object.fromEntries(categories.map(c => [c.value, c.label])),
    [categories]
  );
  const currentSubcategories = useMemo(
    () => subcategories.filter(s => s.category === form.category),
    [subcategories, form.category]
  );

  const nameSuggestions = useMemo(() => {
    const q = form.name.trim().toLowerCase();
    if (!q) return [];
    return subcategories
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [form.name, subcategories]);

  const handleAddSubcategory = async () => {
    const name = newSubcategory.trim();
    if (!name) return;
    try {
      await addSubcategory.mutateAsync({ category: form.category, name });
      setForm(f => ({ ...f, subcategory: name }));
      setNewSubcategory('');
      toast.success('Sous-catégorie ajoutée');
    } catch (e: any) {
      toast.error(e?.message?.includes('duplicate') ? 'Existe déjà' : 'Erreur');
    }
  };

  const handleDeleteSubcategory = async (id: string, name: string) => {
    try {
      await deleteSubcategory.mutateAsync(id);
      if (form.subcategory === name) setForm(f => ({ ...f, subcategory: '' }));
      toast.success('Sous-catégorie supprimée');
    } catch {
      toast.error('Erreur');
    }
  };

  const [filtersByTab, setFiltersByTab] = useState<Record<ChargeType, FilterState>>({
    fixe: { ...emptyFilters },
    recurrente: { ...emptyFilters },
  });
  const [internalShowFilters, setInternalShowFilters] = useState(false);
  const showFilters = showFiltersProp ?? internalShowFilters;
  const setShowFilters = (v: boolean) => {
    setInternalShowFilters(v);
    onShowFiltersChange?.(v);
  };

  const filters = filtersByTab[activeTab];
  const setFilters = (next: FilterState) => setFiltersByTab(prev => ({ ...prev, [activeTab]: next }));
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters({ ...filters, [key]: value });

  const activeFiltersCount =
    (filters.category !== 'all' ? 1 : 0) +
    (filters.frequency !== 'all' ? 1 : 0) +
    (filters.store !== 'all' ? 1 : 0) +
    (filters.product !== 'all' ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.search ? 1 : 0);

  useEffect(() => {
    onActiveFiltersCountChange?.(activeFiltersCount);
  }, [activeFiltersCount, onActiveFiltersCountChange]);

  const resetFilters = () => setFilters({ ...emptyFilters });

  const openAdd = (type: ChargeType) => {
    setActiveTab(type);
    setEditingId(null);
    setEditingOriginal(null);
    setForm({ ...emptyForm, is_recurring: type === 'recurrente' });
    setOpen(true);
  };

  const openEdit = (c: Charge) => {
    setEditingId(c.id);
    setEditingOriginal(c);
    setForm({
      name: c.name,
      amount: String(c.amount),
      category: c.category,
      subcategory: c.subcategory || '',
      charge_date: c.charge_date,
      charge_date_to: c.charge_date_to || '',
      is_recurring: c.is_recurring,
      frequency: c.frequency || 'one_time',
      notes: c.notes || '',
      store_id: c.store_id || '',
      product_id: c.product_id || '',
      product_ids: c.product_ids || (c.product_id ? [c.product_id] : []),
    });
    setOpen(true);
  };

  // A charge is "recurring over time" when its frequency creates repeating
  // periods (monthly, weekly, yearly, per_order) OR when it has been flagged
  // as a recurring charge. One-time charges are edited normally.
  const isRecurringCharge = (c: Charge | null) =>
    !!c && (c.is_recurring || (c.frequency && c.frequency !== 'one_time'));

  const performSimpleSave = async () => {
    const payload = {
      name: form.name,
      amount: Number(form.amount),
      category: form.category,
      subcategory: form.subcategory || null,
      charge_date: form.charge_date,
      charge_date_to: form.charge_date_to || null,
      is_recurring: form.is_recurring,
      charge_type: activeTab,
      frequency: activeTab === 'fixe' ? form.frequency : 'one_time' as ChargeFrequency,
      notes: form.notes || null,
      store_id: form.store_id || null,
      product_id: form.product_ids[0] || form.product_id || null,
      product_ids: form.product_ids.length ? form.product_ids : null,
    };
    if (editingId) {
      await updateCharge.mutateAsync({ id: editingId, ...payload });
      toast.success('Charge modifiée');
    } else {
      await addCharge.mutateAsync(payload);
      toast.success('Charge ajoutée');
    }
    setOpen(false);
    setEditingId(null);
    setEditingOriginal(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.amount) {
      toast.error('Veuillez remplir le nom et le montant');
      return;
    }

    // Detect an amount change on an existing recurring charge → trigger
    // Option A flow (close old period, create new charge).
    const newAmount = Number(form.amount);
    if (
      editingId &&
      editingOriginal &&
      isRecurringCharge(editingOriginal) &&
      Number(editingOriginal.amount) !== newAmount
    ) {
      // Default effective date = today, but never before the original start date
      const today = new Date().toISOString().split('T')[0];
      const defaultEffective = today < editingOriginal.charge_date ? editingOriginal.charge_date : today;
      setAmountEffectiveDate(defaultEffective);
      setAmountChangeOpen(true);
      return;
    }

    try {
      await performSimpleSave();
    } catch {
      toast.error('Erreur');
    }
  };

  const confirmAmountChange = async () => {
    if (!editingOriginal || !editingId) return;
    const effective = amountEffectiveDate;
    if (!effective) {
      toast.error("Date d'effet requise");
      return;
    }
    if (effective < editingOriginal.charge_date) {
      toast.error("La date d'effet doit être après le début de la charge actuelle");
      return;
    }
    try {
      // Compute end-date for the old charge = day before effective date
      const effDate = new Date(effective + 'T00:00:00');
      const endOld = new Date(effDate);
      endOld.setDate(endOld.getDate() - 1);
      const endOldStr = endOld.toISOString().split('T')[0];

      // 1) Close the old charge period (keep its original amount intact for history)
      await updateCharge.mutateAsync({
        id: editingId,
        charge_date_to: endOldStr,
        // Allow the user to also update name / category / subcategory / notes
        // on the historical record without changing its amount.
        name: form.name,
        category: form.category,
        subcategory: form.subcategory || null,
        notes: form.notes || null,
      });

      // 2) Create the new charge starting at the effective date with the new amount
      await addCharge.mutateAsync({
        name: form.name,
        amount: Number(form.amount),
        category: form.category,
        subcategory: form.subcategory || null,
        charge_date: effective,
        charge_date_to: form.charge_date_to && form.charge_date_to >= effective ? form.charge_date_to : null,
        is_recurring: form.is_recurring,
        charge_type: activeTab,
        frequency: activeTab === 'fixe' ? form.frequency : 'one_time' as ChargeFrequency,
        notes: form.notes || null,
        store_id: form.store_id || null,
        product_id: form.product_ids[0] || form.product_id || null,
        product_ids: form.product_ids.length ? form.product_ids : null,
      });

      toast.success('Nouveau montant appliqué — historique préservé');
      setAmountChangeOpen(false);
      setOpen(false);
      setEditingId(null);
      setEditingOriginal(null);
      setForm(emptyForm);
    } catch (e) {
      console.error(e);
      toast.error('Erreur');
    }
  };

  // Filtered charges for the Stats view (uses the 'fixe' filter slot as a global filter)
  const statsFilters = filtersByTab.fixe;
  const statsFiltered = useMemo(() => {
    return charges.filter(c => {
      if (statsFilters.category !== 'all' && c.category !== statsFilters.category) return false;
      if (statsFilters.frequency !== 'all' && (c.frequency || 'one_time') !== statsFilters.frequency) return false;
      if (statsFilters.store !== 'all' && (statsFilters.store === 'none' ? !!c.store_id : c.store_id !== statsFilters.store)) return false;
      if (statsFilters.product !== 'all') {
        const linkedIds = c.product_ids && c.product_ids.length ? c.product_ids : (c.product_id ? [c.product_id] : []);
        if (statsFilters.product === 'none' ? linkedIds.length > 0 : !linkedIds.includes(statsFilters.product)) return false;
      }
      if (statsFilters.from && c.charge_date < statsFilters.from) return false;
      if (statsFilters.to && c.charge_date > statsFilters.to) return false;
      if (statsFilters.search) {
        const q = statsFilters.search.toLowerCase();
        const hit = c.name.toLowerCase().includes(q) || (c.notes?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });
  }, [charges, statsFilters]);

  return (
    <div className="space-y-4">
      {/* Filters floating panel with click-outside-to-close */}
      {showFilters && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowFilters(false)} />
          <div className="fixed top-20 right-6 z-40 w-[360px] rounded-lg border bg-card p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {view === 'stats'
                  ? 'Filtres — Stats'
                  : `Filtres — ${activeTab === 'fixe' ? 'Charges Fixes' : 'Charges Récurrentes'}`}
              </span>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={resetFilters}>
                  <X className="h-3.5 w-3.5" /> Réinitialiser
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Recherche</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nom, notes..." className="pl-8" value={filters.search} onChange={e => updateFilter('search', e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Catégorie</Label>
                <Select value={filters.category} onValueChange={v => updateFilter('category', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(view === 'stats' || activeTab === 'fixe') && (
                <div>
                  <Label className="text-xs">Fréquence</Label>
                  <Select value={filters.frequency} onValueChange={v => updateFilter('frequency', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes fréquences</SelectItem>
                      {frequencies.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Store</Label>
                <Select value={filters.store} onValueChange={v => updateFilter('store', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les stores</SelectItem>
                    <SelectItem value="none">Sans store</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Produit</Label>
                <Select value={filters.product} onValueChange={v => updateFilter('product', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    <SelectItem value="all">Tous les produits</SelectItem>
                    <SelectItem value="none">Sans produit</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Du</Label>
                  <Input type="date" className="mt-1" value={filters.from} onChange={e => updateFilter('from', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Au</Label>
                  <Input type="date" className="mt-1" value={filters.to} onChange={e => updateFilter('to', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {(view === 'all' || view === 'stats') && (
        <ChargesStatsCards
          charges={view === 'stats' ? statsFiltered : charges}
          perOrderResolver={perOrderResolver}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {(view === 'all' || view === 'tables') && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChargeType)}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="recurrente">Charges Récurrentes</TabsTrigger>
              <TabsTrigger value="fixe">Charges Fixes</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="fixe" className="mt-4">
            <ChargesTableSection
              charges={charges}
              isLoading={isLoading}
              type="fixe"
              filters={filtersByTab.fixe}
              categoryLabels={categoryLabels}
              onEdit={openEdit}
              onDelete={(id) => deleteCharge.mutate(id)}
              onAdd={() => openAdd('fixe')}
              perOrderResolver={perOrderResolver}
            />
          </TabsContent>
          <TabsContent value="recurrente" className="mt-4">
            <ChargesTableSection
              charges={charges}
              isLoading={isLoading}
              type="recurrente"
              filters={filtersByTab.recurrente}
              categoryLabels={categoryLabels}
              onEdit={openEdit}
              onDelete={(id) => deleteCharge.mutate(id)}
              onAdd={() => openAdd('recurrente')}
              perOrderResolver={perOrderResolver}
            />
          </TabsContent>
        </Tabs>
      )}

      {view !== 'stats' && (<>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setEditingOriginal(null); setForm(emptyForm); } }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier la charge' : activeTab === 'fixe' ? 'Nouvelle charge fixe' : 'Nouvelle charge récurrente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom</Label>
              <div className="relative">
                <Input
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setShowNameSuggestions(true); }}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                  placeholder="Ex: Loyer bureau"
                  autoComplete="off"
                />
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-md max-h-56 overflow-auto">
                    {nameSuggestions.map(s => {
                      const catLabel = categoryLabels[s.category] || s.category;
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm(f => ({ ...f, name: s.name, category: s.category, subcategory: s.name }));
                            setShowNameSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">{catLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Montant (DA)</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v, subcategory: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date — Du</Label><Input type="date" value={form.charge_date} onChange={e => setForm(f => ({ ...f, charge_date: e.target.value }))} /></div>
              <div><Label>Date — Au <span className="text-xs text-muted-foreground">(optionnel)</span></Label><Input type="date" value={form.charge_date_to} min={form.charge_date} onChange={e => setForm(f => ({ ...f, charge_date_to: e.target.value }))} /></div>
            </div>
            {activeTab === 'fixe' && (
              <div>
                <Label>Fréquence</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as ChargeFrequency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencies.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Store <span className="text-xs text-muted-foreground">(optionnel)</span></Label>
                <Select value={form.store_id || 'none'} onValueChange={v => setForm(f => ({ ...f, store_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produits <span className="text-xs text-muted-foreground">(optionnel, multi)</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-left">
                        {form.product_ids.length === 0
                          ? 'Aucun'
                          : form.product_ids.length === 1
                            ? (products.find(p => p.id === form.product_ids[0])?.name || '1 produit')
                            : `${form.product_ids.length} produits sélectionnés`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <div className="max-h-[260px] overflow-y-auto p-1">
                      {form.product_ids.length > 0 && (
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-sm"
                          onClick={() => setForm(f => ({ ...f, product_ids: [] }))}
                        >
                          Effacer la sélection
                        </button>
                      )}
                      {products.map(p => {
                        const checked = form.product_ids.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => setForm(f => ({
                                ...f,
                                product_ids: v
                                  ? [...f.product_ids, p.id]
                                  : f.product_ids.filter(id => id !== p.id),
                              }))}
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optionnel" /></div>

            <Button onClick={handleSubmit} disabled={addCharge.isPending || updateCharge.isPending} className="w-full">
              {(addCharge.isPending || updateCharge.isPending) ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter la charge'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Amount-change confirmation dialog (Option A: keep history) */}
      <Dialog open={amountChangeOpen} onOpenChange={setAmountChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changement de montant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ancien montant</span>
                <span className="font-medium">{editingOriginal ? formatCurrency(Number(editingOriginal.amount)) : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nouveau montant</span>
                <span className="font-semibold text-primary">{formatCurrency(Number(form.amount || 0))}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Pour préserver l'historique, l'ancien montant sera conservé jusqu'à la veille de la date d'effet,
              et une nouvelle charge sera créée à partir de cette date avec le nouveau montant.
            </p>
            <div>
              <Label>Date d'effet du nouveau montant</Label>
              <Input
                type="date"
                value={amountEffectiveDate}
                min={editingOriginal?.charge_date}
                onChange={e => setAmountEffectiveDate(e.target.value)}
              />
              {editingOriginal && amountEffectiveDate && (() => {
                const effDate = new Date(amountEffectiveDate + 'T00:00:00');
                const endOld = new Date(effDate);
                endOld.setDate(endOld.getDate() - 1);
                return (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ancienne charge : {format(new Date(editingOriginal.charge_date), 'd MMM yyyy', { locale: fr })}
                    {' → '}{format(endOld, 'd MMM yyyy', { locale: fr })}
                    <br />
                    Nouvelle charge : à partir du {format(effDate, 'd MMM yyyy', { locale: fr })}
                  </p>
                );
              })()}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAmountChangeOpen(false)}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={confirmAmountChange}
                disabled={addCharge.isPending || updateCharge.isPending}
              >
                {(addCharge.isPending || updateCharge.isPending) ? 'Application...' : 'Confirmer'}
              </Button>
            </div>
            <button
              type="button"
              onClick={async () => {
                setAmountChangeOpen(false);
                try { await performSimpleSave(); } catch { toast.error('Erreur'); }
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline"
            >
              Modifier sans préserver l'historique (écrase l'ancien montant)
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        defaultCategories={defaultCategories}
      />
      </>)}
    </div>
  );
}
