import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Plus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface LowStockAlertCardProps {
  products: Product[];
  onAddStock: (productId: string) => void;
}

export function LowStockAlertCard({ products, onAddStock }: LowStockAlertCardProps) {
  const getStockStatus = (product: Product) => {
    const available = product.current_stock - product.reserved_stock;
    if (available <= 0) return { label: 'Rupture', variant: 'destructive' as const };
    if (available <= product.reorder_level / 2) return { label: 'Critique', variant: 'destructive' as const };
    return { label: 'Faible', variant: 'outline' as const };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle className="text-lg font-semibold">Alertes de Stock</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {products.length} produit{products.length > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Tous les produits sont en stock ✓
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {products.map((product) => {
              const status = getStockStatus(product);
              const available = product.current_stock - product.reserved_stock;
              
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {available} disponible • Seuil: {product.reorder_level}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge
                      variant={status.variant}
                      className={status.variant === 'outline' ? 'border-warning text-warning' : ''}
                    >
                      {status.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onAddStock(product.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
