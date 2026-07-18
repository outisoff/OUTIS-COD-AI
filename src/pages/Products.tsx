import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Download, Pencil, ShoppingBag, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts } from '@/hooks/useProducts';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { AddProductDialog } from '@/components/products/AddProductDialog';
import { EditProductDialog } from '@/components/products/EditProductDialog';
import { ProductPacksManager } from '@/components/products/ProductPacksManager';
import { ProductBundlesManager } from '@/components/products/ProductBundlesManager';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export default function Products() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: rawProducts, isLoading } = useProducts();
  const { selectedStoreId } = useStoreFilter();
  const products = useMemo(() => {
    if (!rawProducts) return undefined;
    if (!selectedStoreId) return rawProducts;
    return rawProducts.filter(p => p.store_id === selectedStoreId);
  }, [rawProducts, selectedStoreId]);

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowEditDialog(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const getStockStatus = (product: NonNullable<typeof products>[0]) => {
    const available = product.current_stock - product.reserved_stock;
    if (available <= 0) return { label: 'Rupture', variant: 'destructive' as const };
    if (available <= product.reorder_level) return { label: 'Stock faible', variant: 'warning' as const };
    return { label: 'En stock', variant: 'success' as const };
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Produits</h1>
        <p className="page-description">
          Gérez votre catalogue de produits, stocks et packs
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="catalogue" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="catalogue" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Catalogue
          </TabsTrigger>
          <TabsTrigger value="packs" className="gap-2">
            <Package className="h-4 w-4" />
            Packs & Offres
          </TabsTrigger>
          <TabsTrigger value="bundles" className="gap-2">
            <Package className="h-4 w-4" />
            Bundles
          </TabsTrigger>
        </TabsList>

        {/* Catalogue Tab */}
        <TabsContent value="catalogue">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Catalogue Produits ({filteredProducts?.length || 0})
                </CardTitle>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter Produit
                </Button>
              </div>
              
              {/* Search */}
              <div className="flex items-center gap-3 mt-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un produit..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="data-table-header">SKU</TableHead>
                      <TableHead className="data-table-header">Produit</TableHead>
                      <TableHead className="data-table-header">Catégorie</TableHead>
                      <TableHead className="data-table-header text-right">Prix Achat</TableHead>
                      <TableHead className="data-table-header text-right">Prix Vente</TableHead>
                      <TableHead className="data-table-header text-right">Stock</TableHead>
                      <TableHead className="data-table-header">Statut</TableHead>
                      <TableHead className="data-table-header w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const status = getStockStatus(product);
                      const available = product.current_stock - product.reserved_stock;
                      const margin = Number(product.selling_price) > 0
                        ? (((Number(product.selling_price) - Number(product.purchase_price)) / Number(product.selling_price)) * 100).toFixed(0)
                        : '0';
                      
                      return (
                        <TableRow key={product.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{product.name}</p>
                          </TableCell>
                          <TableCell className="text-sm">{product.category}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatCurrency(Number(product.purchase_price))}
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="text-sm font-medium">{formatCurrency(Number(product.selling_price))}</p>
                              <p className="text-xs text-success">+{margin}%</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="text-sm font-medium">{available}</p>
                              <p className="text-xs text-muted-foreground">
                                ({product.reserved_stock} réservé)
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={status.variant === 'success' ? 'default' : status.variant === 'warning' ? 'outline' : 'destructive'}
                              className={status.variant === 'success' ? 'bg-success hover:bg-success' : status.variant === 'warning' ? 'border-warning text-warning' : ''}
                            >
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">Aucun produit trouvé</p>
                  <Button variant="link" onClick={() => setShowAddDialog(true)}>
                    Ajouter votre premier produit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Packs Tab */}
        <TabsContent value="packs">
          <ProductPacksManager />
        </TabsContent>

        {/* Bundles Tab */}
        <TabsContent value="bundles">
          <ProductBundlesManager />
        </TabsContent>
      </Tabs>

      <AddProductDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <EditProductDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
        product={selectedProduct} 
      />
    </div>
  );
}
