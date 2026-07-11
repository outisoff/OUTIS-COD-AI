import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface ProductFilterProps {
  products: Product[];
  selectedProductIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ProductFilter({ products, selectedProductIds, onSelectionChange }: ProductFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    if (selectedProductIds.includes(id)) {
      onSelectionChange(selectedProductIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedProductIds, id]);
    }
  };

  const selectedNames = products
    .filter(p => selectedProductIds.includes(p.id))
    .map(p => p.name);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[160px] justify-between">
          <div className="flex items-center gap-2 truncate">
            <Package className="h-4 w-4 shrink-0" />
            {selectedProductIds.length === 0 ? (
              <span className="text-muted-foreground">Tous les produits</span>
            ) : (
              <span className="truncate">
                {selectedProductIds.length} produit{selectedProductIds.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {selectedProductIds.length > 0 ? (
            <X
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onSelectionChange([]);
              }}
            />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-2 border-b">
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Aucun produit trouvé
              </div>
            ) : (
              filtered.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => toggle(product.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer text-left",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-4 w-4 rounded-sm border shrink-0",
                      isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{product.name}</span>
                      <span className="text-[10px] text-muted-foreground">{product.sku}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
        {selectedProductIds.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => {
                onSelectionChange([]);
                setOpen(false);
              }}
            >
              Réinitialiser le filtre
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
