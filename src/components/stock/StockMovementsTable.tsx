import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StockMovement, StockMovementType } from '@/hooks/useStockMovements';
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, ShoppingCart, RotateCcw } from 'lucide-react';

interface StockMovementsTableProps {
  movements: StockMovement[];
  showProduct?: boolean;
}

const movementTypeConfig: Record<StockMovementType, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  entry: { 
    label: 'Entrée', 
    icon: <ArrowDownCircle className="h-4 w-4 text-green-500" />,
    variant: 'default'
  },
  exit: { 
    label: 'Sortie', 
    icon: <ArrowUpCircle className="h-4 w-4 text-red-500" />,
    variant: 'destructive'
  },
  adjustment: { 
    label: 'Ajustement', 
    icon: <RefreshCw className="h-4 w-4 text-blue-500" />,
    variant: 'secondary'
  },
  sale: { 
    label: 'Vente', 
    icon: <ShoppingCart className="h-4 w-4 text-orange-500" />,
    variant: 'outline'
  },
  return: { 
    label: 'Retour', 
    icon: <RotateCcw className="h-4 w-4 text-purple-500" />,
    variant: 'secondary'
  },
};

export function StockMovementsTable({ movements, showProduct = true }: StockMovementsTableProps) {
  if (movements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun mouvement de stock enregistré
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showProduct && <TableHead>Produit</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead className="text-center">Quantité</TableHead>
            <TableHead className="text-center">Avant</TableHead>
            <TableHead className="text-center">Après</TableHead>
            <TableHead>Référence</TableHead>
            <TableHead>Motif</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const config = movementTypeConfig[movement.movement_type];
            const quantityChange = movement.new_stock - movement.previous_stock;
            
            return (
              <TableRow key={movement.id}>
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(movement.created_at), 'dd-MMM-yy')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(movement.created_at), 'HH:mm')}
                  </div>
                </TableCell>
                {showProduct && (
                  <TableCell>
                    <div className="font-medium">{movement.products?.name}</div>
                    <div className="text-xs text-muted-foreground">{movement.products?.sku}</div>
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className={quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {quantityChange >= 0 ? '+' : ''}{quantityChange}
                  </span>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {movement.previous_stock}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {movement.new_stock}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {movement.reference || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {movement.reason || '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
