import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, X, Search, Filter, Package, Tag, MapPin, UserCheck, Truck, Globe, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface FilterSelectProps {
  title: string;
  placeholder: string;
  options: FilterOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  searchable?: boolean;
  icon?: React.ReactNode;
  color: string;
}

function FilterSelect({ title, placeholder, options, selectedValues, onSelectionChange, searchable = true, icon, color }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const toggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const displayText = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? (options.find(o => o.value === selectedValues[0])?.label || selectedValues[0])
      : `${selectedValues.length} sélectionnés`;

  const isActive = selectedValues.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg cursor-pointer text-left transition-all duration-150",
          isActive
            ? `bg-gradient-to-r ${color} text-white shadow-sm`
            : "bg-muted/40 hover:bg-muted/80 text-foreground"
        )}>
          {icon && (
            <span className={cn("shrink-0 opacity-70", isActive && "opacity-100")}>
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <span className={cn(
              "text-[11px] font-medium leading-none block",
              isActive ? "text-white/70" : "text-muted-foreground"
            )}>
              {title}
            </span>
            <span className={cn(
              "text-xs truncate block mt-0.5 font-medium",
              isActive ? "text-white" : "text-foreground/70"
            )}>
              {displayText}
            </span>
          </div>
          {isActive ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {selectedValues.length}
              </span>
              <X
                className="h-3 w-3 text-white/60 hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onSelectionChange([]); }}
              />
            </div>
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {searchable && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm pl-7"
              />
            </div>
          </div>
        )}
        <ScrollArea className="max-h-56">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Aucun résultat</div>
            ) : (
              filtered.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer text-left transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-colors",
                      isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/25"
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className="text-[10px] text-muted-foreground">{option.sublabel}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
        {selectedValues.length > 0 && (
          <div className="border-t p-1.5">
            <button
              className="w-full text-xs text-center py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => { onSelectionChange([]); setOpen(false); }}
            >
              Réinitialiser
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export interface DashboardFiltersState {
  productIds: string[];
  categories: string[];
  wilayas: string[];
  agents: string[];
  deliveryCompanies: string[];
  sources: string[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
}

interface DashboardFiltersProps {
  products: Product[];
  orders: { wilaya: string; assigned_agent: string | null; delivery_company: string | null; source: string }[];
  filters: DashboardFiltersState;
  onFiltersChange: (filters: DashboardFiltersState) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  website: 'Website',
  phone: 'Téléphone',
  other: 'Autre',
};

export function DashboardFilters({ products, orders, filters, onFiltersChange }: DashboardFiltersProps) {
  const productOptions: FilterOption[] = products.map(p => ({ value: p.id, label: p.name, sublabel: p.sku }));

  const categoryOptions: FilterOption[] = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    return cats.map(c => ({ value: c, label: c }));
  }, [products]);

  const wilayaOptions: FilterOption[] = useMemo(() => {
    const wilayas = [...new Set(orders.map(o => o.wilaya).filter(Boolean))].sort();
    return wilayas.map(w => ({ value: w, label: w }));
  }, [orders]);

  const agentOptions: FilterOption[] = useMemo(() => {
    const agents = [...new Set(orders.map(o => o.assigned_agent).filter(Boolean) as string[])].sort();
    return agents.map(a => ({ value: a, label: a }));
  }, [orders]);

  const deliveryCompanyOptions: FilterOption[] = useMemo(() => {
    const companies = [...new Set(orders.map(o => o.delivery_company).filter(Boolean) as string[])].sort();
    return companies.map(c => ({ value: c, label: c }));
  }, [orders]);

  const sourceOptions: FilterOption[] = useMemo(() => {
    const sources = [...new Set(orders.map(o => o.source).filter(Boolean))].sort();
    return sources.map(s => ({ value: s, label: SOURCE_LABELS[s] || s }));
  }, [orders]);

  const update = (key: keyof DashboardFiltersState) => (values: string[]) => {
    onFiltersChange({ ...filters, [key]: values });
  };

  const activeCount = Object.values(filters).filter(arr => arr.length > 0).length;

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Filtres</h3>
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={() => onFiltersChange({ productIds: [], categories: [], wilayas: [], agents: [], deliveryCompanies: [], sources: [] })}
            className="text-[11px] text-destructive/80 hover:text-destructive font-medium transition-colors"
          >
            Effacer tout
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <FilterSelect
          title="Produit"
          placeholder="Tous"
          options={productOptions}
          selectedValues={filters.productIds}
          onSelectionChange={update('productIds')}
          icon={<Package className="h-3.5 w-3.5" />}
          color="from-blue-500 to-blue-600"
        />
        <FilterSelect
          title="Catégorie"
          placeholder="Toutes"
          options={categoryOptions}
          selectedValues={filters.categories}
          onSelectionChange={update('categories')}
          icon={<Tag className="h-3.5 w-3.5" />}
          color="from-violet-500 to-violet-600"
        />
        <FilterSelect
          title="Wilaya"
          placeholder="Toutes"
          options={wilayaOptions}
          selectedValues={filters.wilayas}
          onSelectionChange={update('wilayas')}
          icon={<MapPin className="h-3.5 w-3.5" />}
          color="from-emerald-500 to-emerald-600"
        />
        <FilterSelect
          title="Agent"
          placeholder="Tous"
          options={agentOptions}
          selectedValues={filters.agents}
          onSelectionChange={update('agents')}
          icon={<UserCheck className="h-3.5 w-3.5" />}
          color="from-amber-500 to-amber-600"
        />
        <FilterSelect
          title="Livraison"
          placeholder="Toutes"
          options={deliveryCompanyOptions}
          selectedValues={filters.deliveryCompanies}
          onSelectionChange={update('deliveryCompanies')}
          icon={<Truck className="h-3.5 w-3.5" />}
          color="from-rose-500 to-rose-600"
        />
        <FilterSelect
          title="Source"
          placeholder="Toutes"
          options={sourceOptions}
          selectedValues={filters.sources}
          onSelectionChange={update('sources')}
          icon={<Globe className="h-3.5 w-3.5" />}
          color="from-cyan-500 to-cyan-600"
        />
      </div>
    </div>
  );
}
