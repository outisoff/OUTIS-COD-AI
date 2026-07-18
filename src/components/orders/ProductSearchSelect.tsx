import { useState, useMemo, useRef } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface Product {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  current_stock: number;
  reserved_stock: number;
}

interface ProductSearchSelectProps {
  products: Product[];
  value: string;
  onSelect: (productId: string) => void;
  placeholder?: string;
}

export function ProductSearchSelect({ 
  products, 
  value, 
  onSelect,
  placeholder = "Rechercher un produit..."
}: ProductSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  // Filter products by name OR SKU
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    
    const query = searchQuery.toLowerCase().trim();
    return products.filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const selectedProduct = products.find(p => p.id === value);

  const handleSelect = (productId: string) => {
    onSelect(productId);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        setSearchQuery('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal"
          type="button"
        >
          {selectedProduct ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-medium truncate">{selectedProduct.name}</span>
              <span className="text-muted-foreground text-xs shrink-0">
                - {formatCurrency(Number(selectedProduct.selling_price))}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[200] bg-popover border border-border shadow-lg" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-3 bg-popover">
          <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
          <Input
            ref={inputRef}
            placeholder="Rechercher par nom ou SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 h-10 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          />
        </div>
        {/*
          Use native overflow scrolling here (instead of Radix ScrollArea) because this select
          lives inside another ScrollArea (the dialog). This ensures mouse wheel scroll works
          reliably and prevents the parent from stealing the wheel events.
        */}
        <div
          className="max-h-[220px] overflow-y-auto overscroll-contain"
          onWheelCapture={(e) => e.stopPropagation()}
          onTouchMoveCapture={(e) => e.stopPropagation()}
        >
          <div className="p-1">
            {filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucun produit trouvé.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const availableStock = product.current_stock - product.reserved_stock;
                const isSelected = value === product.id;
                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelect(product.id)}
                    className={cn(
                      "flex items-center w-full py-2 px-2 rounded-sm cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-accent text-accent-foreground" 
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{product.name}</span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          {formatCurrency(Number(product.selling_price))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="bg-muted px-1.5 py-0.5 rounded font-mono">{product.sku}</span>
                        <span>• Stock: {availableStock}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
