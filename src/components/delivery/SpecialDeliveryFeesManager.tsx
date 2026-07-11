import { useState, useMemo } from 'react';
import { Search, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpecialDeliveryFees, useUpdateSpecialDeliveryFee, SpecialDeliveryFee } from '@/hooks/useSpecialDeliveryFees';

export function SpecialDeliveryFeesManager() {
  const { data: fees, isLoading } = useSpecialDeliveryFees();
  const updateFee = useUpdateSpecialDeliveryFee();
  const [searchQuery, setSearchQuery] = useState('');
  const [editedFees, setEditedFees] = useState<Record<string, { home: number; desk: number }>>({});
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

  const handleFeeChange = (id: string, type: 'home' | 'desk', value: string) => {
    const numValue = parseFloat(value) || 0;
    const fee = fees?.find(f => f.id === id);
    if (!fee) return;

    setEditedFees((prev) => ({
      ...prev,
      [id]: {
        home: type === 'home' ? numValue : (prev[id]?.home ?? fee.home_delivery_fee),
        desk: type === 'desk' ? numValue : (prev[id]?.desk ?? fee.stop_desk_fee),
      },
    }));
  };

  const getDisplayValue = (fee: SpecialDeliveryFee, type: 'home' | 'desk') => {
    if (editedFees[fee.id] !== undefined) {
      return type === 'home' ? editedFees[fee.id].home : editedFees[fee.id].desk;
    }
    return type === 'home' ? fee.home_delivery_fee : fee.stop_desk_fee;
  };

  const hasChanges = (fee: SpecialDeliveryFee) => {
    const edited = editedFees[fee.id];
    if (!edited) return false;
    return (
      edited.home !== fee.home_delivery_fee || 
      edited.desk !== fee.stop_desk_fee
    );
  };

  const handleSave = async (fee: SpecialDeliveryFee) => {
    const edited = editedFees[fee.id];
    if (!edited) return;

    setSavingId(fee.id);
    try {
      await updateFee.mutateAsync({
        id: fee.id,
        home_delivery_fee: edited.home,
        stop_desk_fee: edited.desk,
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
        <h3 className="text-lg font-medium">Tarifs Spéciaux par Wilaya</h3>
        <p className="text-sm text-muted-foreground">
          Définissez des tarifs de livraison spéciaux par wilaya (s'applique aux produits avec le tier "Spécial 1")
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
                    value={getDisplayValue(fee, 'home')}
                    onChange={(e) => handleFeeChange(fee.id, 'home', e.target.value)}
                    className="text-center"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={getDisplayValue(fee, 'desk')}
                    onChange={(e) => handleFeeChange(fee.id, 'desk', e.target.value)}
                    className="text-center"
                  />
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
