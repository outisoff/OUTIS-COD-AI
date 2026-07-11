import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockMovementsTable } from '@/components/stock/StockMovementsTable';
import { Loader2 } from 'lucide-react';
import type { StockMovement } from '@/hooks/useStockMovements';

interface StockReturnsTabProps {
  movements: StockMovement[] | undefined;
  isLoading: boolean;
}

export function StockReturnsTab({ movements, isLoading }: StockReturnsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mouvements de retour</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : movements ? (
          <StockMovementsTable
            movements={movements.filter(m => m.movement_type === 'return')}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
