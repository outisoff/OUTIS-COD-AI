import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpDown, Plus, Minus, AlertTriangle, Search } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface StockInventoryTableProps {
  products: Product[];
  onAddStock: (productId: string) => void;
  onRemoveStock: (productId: string) => void;
}

type SortField = 'name' | 'current_stock' | 'reserved_stock' | 'available' | 'purchase_price' | 'stock_value';
type SortDirection = 'asc' | 'desc';

export function StockInventoryTable({ products, onAddStock, onRemoveStock }: StockInventoryTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku.toLowerCase().includes(search.toLowerCase()) ||
    product.category.toLowerCase().includes(search.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;

    switch (sortField) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'current_stock':
        aValue = a.current_stock;
        bValue = b.current_stock;
        break;
      case 'reserved_stock':
        aValue = a.reserved_stock;
        bValue = b.reserved_stock;
        break;
      case 'available':
        aValue = a.current_stock - a.reserved_stock;
        bValue = b.current_stock - b.reserved_stock;
        break;
      case 'purchase_price':
        aValue = a.average_purchase_price || a.purchase_price;
        bValue = b.average_purchase_price || b.purchase_price;
        break;
      case 'stock_value':
        aValue = a.current_stock * (a.average_purchase_price || a.purchase_price);
        bValue = b.current_stock * (b.average_purchase_price || b.purchase_price);
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue as string)
        : (bValue as string).localeCompare(aValue);
    }

    return sortDirection === 'asc' ? aValue - (bValue as number) : (bValue as number) - aValue;
  });

  const getStockStatus = (product: Product) => {
    const available = product.current_stock - product.reserved_stock;
    if (available <= 0) return { label: 'Rupture', variant: 'destructive' as const, icon: true };
    if (available <= product.reorder_level) return { label: 'Bas', variant: 'outline' as const, icon: true };
    return { label: 'OK', variant: 'secondary' as const, icon: false };
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('name')}>
                  Produit
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('current_stock')}>
                  Stock Total
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('reserved_stock')}>
                  Réservé
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('available')}>
                  Disponible
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Seuil</TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('purchase_price')}>
                  Prix Achat
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('stock_value')}>
                  Valeur Stock
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Aucun produit trouvé
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => {
                const available = product.current_stock - product.reserved_stock;
                const status = getStockStatus(product);
                const avgPrice = product.average_purchase_price || product.purchase_price;
                const stockValue = product.current_stock * avgPrice;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {product.current_stock}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {product.reserved_stock}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={available <= product.reorder_level ? 'text-warning font-medium' : ''}>
                        {available}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {product.reorder_level}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {avgPrice.toLocaleString('fr-DZ')} DA
                    </TableCell>
                    <TableCell className="text-center font-medium text-primary">
                      {stockValue.toLocaleString('fr-DZ')} DA
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={status.variant} className="gap-1">
                        {status.icon && <AlertTriangle className="h-3 w-3" />}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onAddStock(product.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
