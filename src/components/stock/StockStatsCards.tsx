import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ArrowUpDown, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface StockStatsCardsProps {
  products: Tables<'products'>[];
  lowStockCount: number;
}

export function StockStatsCards({ products, lowStockCount }: StockStatsCardsProps) {
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.current_stock, 0);
  const reservedStock = products.reduce((sum, p) => sum + p.reserved_stock, 0);

  const totalStockValue = products.reduce((sum, p) => {
    const avgPrice = p.average_purchase_price || p.purchase_price;
    return sum + (p.current_stock * avgPrice);
  }, 0);

  const avgPurchasePrice = totalStock > 0 ? totalStockValue / totalStock : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Produits</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStock}</div>
          <p className="text-xs text-muted-foreground">{reservedStock} réservé</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disponible</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStock - reservedStock}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Prix Moyen Achat</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgPurchasePrice.toFixed(2)} DA</div>
          <p className="text-xs text-muted-foreground">par produit</p>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valeur Totale Stock</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {totalStockValue.toLocaleString('fr-DZ')} DA
          </div>
          <p className="text-xs text-muted-foreground">marchandise en stock</p>
        </CardContent>
      </Card>

      <Card className={lowStockCount > 0 ? 'border-warning' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Bas</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${lowStockCount > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-warning' : ''}`}>
            {lowStockCount}
          </div>
          <p className="text-xs text-muted-foreground">
            produit{lowStockCount !== 1 ? 's' : ''} à réapprovisionner
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
