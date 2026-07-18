import { Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { OrderWithItems } from '@/hooks/useOrders';
import { printBordereaux } from './printBordereaux';

interface PrintBordereauDialogProps {
  order: OrderWithItems;
}

export function PrintBordereauDialog({ order }: PrintBordereauDialogProps) {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      await printBordereaux([order]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
      title="Bordereau"
      onClick={handlePrint}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
    </Button>
  );
}
