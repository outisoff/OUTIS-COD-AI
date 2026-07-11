import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockMovementsTable } from '@/components/stock/StockMovementsTable';
import { ArrowUpDown, DollarSign, Loader2 } from 'lucide-react';
import type { StockMovement } from '@/hooks/useStockMovements';

interface StockHistoryTabProps {
  movements: StockMovement[] | undefined;
  isLoading: boolean;
}

export function StockHistoryTab({ movements, isLoading }: StockHistoryTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des mouvements</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : movements ? (
          <Tabs defaultValue="stock-movements" className="space-y-4">
            <TabsList>
              <TabsTrigger value="stock-movements" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Mouvements Stock
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Ventes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stock-movements">
              <StockMovementsTable
                movements={movements.filter(m =>
                  ['entry', 'adjustment', 'return'].includes(m.movement_type) ||
                  (m.movement_type === 'exit' && !m.reference)
                )}
              />
            </TabsContent>

            <TabsContent value="sales">
              <StockMovementsTable
                movements={movements.filter(m =>
                  m.movement_type === 'sale' ||
                  (m.movement_type === 'exit' && m.reference)
                )}
              />
            </TabsContent>
          </Tabs>
        ) : null}
      </CardContent>
    </Card>
  );
}
