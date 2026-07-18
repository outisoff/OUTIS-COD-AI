import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, User, ShoppingCart, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useOrders } from '@/hooks/useOrders';
import { phoneMatchesQuery } from '@/lib/phoneSearch';
import { formatOrderNumber } from '@/lib/formatOrderNumber';

interface MentionPickerProps {
  onSelect: (text: string) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

type TabId = 'product' | 'customer' | 'order';

export function MentionPicker({ onSelect, align = 'start', side }: MentionPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('product');
  const [q, setQ] = useState('');

  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const { data: orders = [] } = useOrders(open);

  const query = q.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    if (!query) return products.slice(0, 30);
    return products.filter((p: any) =>
      p.name?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query)
    ).slice(0, 30);
  }, [products, query]);

  const filteredCustomers = useMemo(() => {
    if (!query) return customers.slice(0, 30);
    return customers.filter((c: any) =>
      c.name?.toLowerCase().includes(query) ||
      phoneMatchesQuery(c.phone, query) ||
      c.wilaya?.toLowerCase().includes(query)
    ).slice(0, 30);
  }, [customers, query]);

  const filteredOrders = useMemo(() => {
    if (!query) return orders.slice(0, 30);
    return orders.filter((o: any) =>
      o.order_number?.toLowerCase().includes(query) ||
      o.customer_name?.toLowerCase().includes(query) ||
      phoneMatchesQuery(o.customer_phone, query)
    ).slice(0, 30);
  }, [orders, query]);

  const pick = (text: string) => {
    onSelect(text);
    setOpen(false);
    setQ('');
  };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'product', label: 'Produit', icon: Package },
    { id: 'customer', label: 'Client', icon: User },
    { id: 'order', label: 'Commande', icon: ShoppingCart },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" type="button" title="Mentionner">
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-[360px] p-0">
        <div className="flex items-center gap-1 border-b p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                  tab === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher..."
            className="h-7 border-0 p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            autoFocus
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {tab === 'product' && (
            filteredProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun produit</p>
            ) : filteredProducts.map((p: any) => (
              <button
                key={p.id}
                onClick={() => pick(`@produit:"${p.name}" (SKU: ${p.sku}) `)}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
              >
                <Package className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.sku} • Stock: {p.current_stock}</div>
                </div>
              </button>
            ))
          )}
          {tab === 'customer' && (
            filteredCustomers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun client</p>
            ) : filteredCustomers.map((c: any) => (
              <button
                key={c.id}
                onClick={() => pick(`@client:"${c.name}" (${c.phone}) `)}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
              >
                <User className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.phone} • {c.wilaya}</div>
                </div>
              </button>
            ))
          )}
          {tab === 'order' && (
            filteredOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucune commande</p>
            ) : filteredOrders.map((o: any) => (
              <button
                key={o.id}
                onClick={() => pick(`@commande:${formatOrderNumber(o.order_number)} (${o.customer_name}) `)}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
              >
                <ShoppingCart className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{formatOrderNumber(o.order_number)}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.customer_name} • {o.status}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
