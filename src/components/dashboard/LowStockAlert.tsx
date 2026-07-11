import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { Product } from '@/types';

interface LowStockAlertProps {
  products: Product[];
}

export function LowStockAlert({ products }: LowStockAlertProps) {
  const getStockStatus = (product: Product) => {
    const available = product.currentStock - product.reservedStock;
    if (available <= 0) return { label: 'Rupture', variant: 'destructive' as const };
    if (available <= product.reorderLevel / 2) return { label: 'Critique', variant: 'destructive' as const };
    return { label: 'Faible', variant: 'warning' as const };
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <CardTitle className="text-base font-semibold">Alertes Stock</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Tous les produits sont en stock
          </p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const status = getStockStatus(product);
              const available = product.currentStock - product.reservedStock;
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {available} disponible • Seuil: {product.reorderLevel}
                    </p>
                  </div>
                  <Badge
                    variant={status.variant === 'warning' ? 'outline' : 'destructive'}
                    className={status.variant === 'warning' ? 'border-warning text-warning' : ''}
                  >
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
