import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useProducts, useLowStockProducts } from '@/hooks/useProducts';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { useStockMovements, StockMovementType } from '@/hooks/useStockMovements';
import { StockMovementDialog } from '@/components/stock/StockMovementDialog';
import { StockInventoryTable } from '@/components/stock/StockInventoryTable';
import { LowStockAlertCard } from '@/components/stock/LowStockAlertCard';
import { StockStatsCards } from '@/components/stock/StockStatsCards';
import { StockReturnsTab } from '@/components/stock/StockReturnsTab';
import { StockHistoryTab } from '@/components/stock/StockHistoryTab';
import { Package, History, Plus, Loader2, RefreshCw } from 'lucide-react';

export default function Stock() {
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>();
  const [defaultMovementType, setDefaultMovementType] = useState<StockMovementType>('entry');

  const { data: rawProducts, isLoading: productsLoading } = useProducts();
  const { data: rawLowStockProducts, isLoading: lowStockLoading } = useLowStockProducts();
  const { selectedStoreId } = useStoreFilter();
  const { data: movements, isLoading: movementsLoading } = useStockMovements();

  const products = useMemo(() => {
    if (!rawProducts) return undefined;
    if (!selectedStoreId) return rawProducts;
    return rawProducts.filter(p => p.store_id === selectedStoreId);
  }, [rawProducts, selectedStoreId]);

  const lowStockProducts = useMemo(() => {
    if (!rawLowStockProducts) return undefined;
    if (!selectedStoreId) return rawLowStockProducts;
    return rawLowStockProducts.filter(p => p.store_id === selectedStoreId);
  }, [rawLowStockProducts, selectedStoreId]);

  const handleAddStock = (productId: string) => {
    setSelectedProductId(productId);
    setDefaultMovementType('entry');
    setMovementDialogOpen(true);
  };

  const handleRemoveStock = (productId: string) => {
    setSelectedProductId(productId);
    setDefaultMovementType('exit');
    setMovementDialogOpen(true);
  };

  const handleOpenNewMovement = () => {
    setSelectedProductId(undefined);
    setDefaultMovementType('entry');
    setMovementDialogOpen(true);
  };

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const lowStockCount = lowStockProducts?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion du Stock</h1>
          <p className="text-muted-foreground">Gérez les entrées, sorties et niveaux de stock</p>
        </div>
        <Button onClick={handleOpenNewMovement}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau mouvement
        </Button>
      </div>

      {/* Stats Cards */}
      {products && (
        <StockStatsCards products={products} lowStockCount={lowStockCount} />
      )}

      {/* Low Stock Alerts */}
      {lowStockLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : lowStockProducts && lowStockProducts.length > 0 ? (
        <LowStockAlertCard products={lowStockProducts} onAddStock={handleAddStock} />
      ) : null}

      {/* Main Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Inventaire
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retour
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventaire des produits</CardTitle>
            </CardHeader>
            <CardContent>
              {products && (
                <StockInventoryTable
                  products={products}
                  onAddStock={handleAddStock}
                  onRemoveStock={handleRemoveStock}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns">
          <StockReturnsTab movements={movements} isLoading={movementsLoading} />
        </TabsContent>

        <TabsContent value="history">
          <StockHistoryTab movements={movements} isLoading={movementsLoading} />
        </TabsContent>
      </Tabs>

      {/* Movement Dialog */}
      <StockMovementDialog
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
        defaultProductId={selectedProductId}
        defaultMovementType={defaultMovementType}
      />
    </div>
  );
}
