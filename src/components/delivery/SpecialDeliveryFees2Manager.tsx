import { useState, useMemo } from 'react';
import { Search, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpecialDeliveryFees2, useUpdateSpecialDeliveryFee2 } from '@/hooks/useSpecialDeliveryFees2';

export function SpecialDeliveryFees2Manager() {
  const { data: fees, isLoading } = useSpecialDeliveryFees2();
  const updateFee = useUpdateSpecialDeliveryFee2();
  const [searchQuery, setSearchQuery] = useState('');
  const [editedFees, setEditedFees] = useState<Record<string, { home: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredFees = useMemo(() => {
    if (!fees) return [];
    if (!searchQuery) return fees;

    const query = searchQuery.toLowerCase();
    return fees.filter(
      (fee) =>
        fee.wilaya_name.toLowerCase().includes(query) ||
        fee.wilaya_code.includes(query)
    );
  }, [fees, searchQuery]);

  const handleFeeChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedFees((prev) => ({
      ...prev,
      [id]: { home: numValue },
    }));
  };

  const getDisplayValue = (fee: any) => {
    if (editedFees[fee.id] !== undefined) {
      return editedFees[fee.id].home;
    }
    return fee.home_delivery_fee;
  };

  const hasChanges = (fee: any) => {
    const edited = editedFees[fee.id];
    if (!edited) return false;
    return edited.home !== fee.home_delivery_fee;
  };

  const handleSave = async (fee: any) => {
    const edited = editedFees[fee.id];
    if (!edited) return;

    setSavingId(fee.id);
    try {
      await updateFee.mutateAsync({
        id: fee.id,
        home_delivery_fee: edited.home,
        stop_desk_fee: 0, // Always 0 - Gratuit au Bureau
      });
      setEditedFees((prev) => {
        const next = { ...prev };
        delete next[fee.id];
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
      <div>
        <h3 className="text-lg font-medium">Gratuit au Bureau</h3>
        <p className="text-sm text-muted-foreground">
          Les frais Stop Desk sont automatiquement à <strong>0 DA</strong> (gratuit). Définissez uniquement les frais à domicile.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par wilaya..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[80px]">Code</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead className="w-[150px] text-center">Domicile (DA)</TableHead>
              <TableHead className="w-[150px] text-center">Stop Desk (DA)</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFees.map((fee) => (
              <TableRow key={fee.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-muted-foreground">
                  {fee.wilaya_code.padStart(2, '0')}
                </TableCell>
                <TableCell className="font-medium text-primary">
                  {fee.wilaya_name}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={getDisplayValue(fee)}
                    onChange={(e) => handleFeeChange(fee.id, e.target.value)}
                    className="text-center"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-semibold">
                    GRATUIT
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!hasChanges(fee) || savingId === fee.id}
                    onClick={() => handleSave(fee)}
                    className={hasChanges(fee) ? 'text-primary' : 'text-muted-foreground'}
                  >
                    {savingId === fee.id ? (
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

      {filteredFees.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Aucune wilaya trouvée
        </p>
      )}
    </div>
  );
}
