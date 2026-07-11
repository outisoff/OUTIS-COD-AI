import { useState, useMemo } from 'react';
import { Search, Save, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, useUpdateProduct } from '@/hooks/useProducts';

export function ProductDeliveryFeesManager() {
  const { data: products, isLoading } = useProducts();
  const updateProduct = useUpdateProduct();
  const [searchQuery, setSearchQuery] = useState('');
  const [editedFees, setEditedFees] = useState<Record<string, { home: number | null; desk: number | null }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const handleFeeChange = (id: string, type: 'home' | 'desk', value: string) => {
    const numValue = value === '' ? null : (parseFloat(value) || 0);
    const product = products?.find(p => p.id === id);
    if (!product) return;

    setEditedFees((prev) => ({
      ...prev,
      [id]: {
        home: type === 'home' ? numValue : (prev[id]?.home ?? product.custom_home_delivery_fee ?? null),
        desk: type === 'desk' ? numValue : (prev[id]?.desk ?? product.custom_stop_desk_fee ?? null),
      },
    }));
  };

  const getDisplayValue = (product: any, type: 'home' | 'desk') => {
    if (editedFees[product.id] !== undefined) {
      const val = type === 'home' ? editedFees[product.id].home : editedFees[product.id].desk;
      return val ?? '';
    }
    const val = type === 'home' ? product.custom_home_delivery_fee : product.custom_stop_desk_fee;
    return val ?? '';
  };

  const hasChanges = (product: any) => {
    const edited = editedFees[product.id];
    if (!edited) return false;
    return (
      edited.home !== (product.custom_home_delivery_fee ?? null) || 
      edited.desk !== (product.custom_stop_desk_fee ?? null)
    );
  };

  const hasCustomFees = (product: any) => {
    return product.custom_home_delivery_fee !== null || product.custom_stop_desk_fee !== null;
  };

  const handleSave = async (product: any) => {
    const edited = editedFees[product.id];
    if (!edited) return;

    setSavingId(product.id);
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        custom_home_delivery_fee: edited.home,
        custom_stop_desk_fee: edited.desk,
      });
      // Clear edited state after successful save
      setEditedFees((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Tarifs par Produit</h3>
        <p className="text-sm text-muted-foreground">
          Définissez des tarifs de livraison personnalisés pour certains produits (laissez vide pour utiliser le tarif standard)
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Produit</TableHead>
              <TableHead className="w-[150px] text-right">Domicile (DA)</TableHead>
              <TableHead className="w-[150px] text-right">Stop Desk (DA)</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                        {product.free_delivery && (
                          <Badge variant="secondary" className="text-xs">Livraison gratuite</Badge>
                        )}
                        {hasCustomFees(product) && !product.free_delivery && (
                          <Badge variant="outline" className="text-xs">Tarif personnalisé</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="Standard"
                    value={getDisplayValue(product, 'home')}
                    onChange={(e) => handleFeeChange(product.id, 'home', e.target.value)}
                    className="w-full text-right"
                    disabled={product.free_delivery}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="Standard"
                    value={getDisplayValue(product, 'desk')}
                    onChange={(e) => handleFeeChange(product.id, 'desk', e.target.value)}
                    className="w-full text-right"
                    disabled={product.free_delivery}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={hasChanges(product) ? 'default' : 'ghost'}
                    disabled={!hasChanges(product) || savingId === product.id}
                    onClick={() => handleSave(product)}
                    className="w-full"
                  >
                    {savingId === product.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredProducts.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Aucun produit trouvé
        </p>
      )}
    </div>
  );
}
