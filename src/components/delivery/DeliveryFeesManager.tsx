import { useState, useMemo } from 'react';
import { Search, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeliveryFees, useUpdateDeliveryFee, DeliveryFee } from '@/hooks/useDeliveryFees';
import { Skeleton } from '@/components/ui/skeleton';

export function DeliveryFeesManager() {
  const { data: fees, isLoading } = useDeliveryFees();
  const updateFee = useUpdateDeliveryFee();
  const [searchQuery, setSearchQuery] = useState('');
  const [editedFees, setEditedFees] = useState<Record<string, { home: number; desk: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredFees = useMemo(() => {
    if (!fees) return [];
    if (!searchQuery) return fees;

    const query = searchQuery.toLowerCase();
    return fees.filter(
      (fee) =>
        fee.wilaya_code.includes(query) ||
        fee.wilaya_name.toLowerCase().includes(query)
    );
  }, [fees, searchQuery]);

  const handleFeeChange = (id: string, type: 'home' | 'desk', value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedFees((prev) => ({
      ...prev,
      [id]: {
        home: type === 'home' ? numValue : (prev[id]?.home ?? 0),
        desk: type === 'desk' ? numValue : (prev[id]?.desk ?? 0),
      },
    }));
  };

  const getDisplayValue = (fee: DeliveryFee, type: 'home' | 'desk') => {
    if (editedFees[fee.id]) {
      return type === 'home' ? editedFees[fee.id].home : editedFees[fee.id].desk;
    }
    return type === 'home' ? fee.home_delivery_fee : fee.stop_desk_fee;
  };

  const hasChanges = (fee: DeliveryFee) => {
    const edited = editedFees[fee.id];
    if (!edited) return false;
    return (
      edited.home !== fee.home_delivery_fee || edited.desk !== fee.stop_desk_fee
    );
  };

  const handleSave = async (fee: DeliveryFee) => {
    const edited = editedFees[fee.id];
    if (!edited) return;

    setSavingId(fee.id);
    try {
      await updateFee.mutateAsync({
        id: fee.id,
        home_delivery_fee: edited.home,
        stop_desk_fee: edited.desk,
      });
      // Clear edited state after successful save
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
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par code ou nom..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[80px]">Code</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead className="w-[150px] text-right">Domicile (DA)</TableHead>
              <TableHead className="w-[150px] text-right">Stop Desk (DA)</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFees.map((fee) => (
              <TableRow key={fee.id} className="hover:bg-muted/50">
                <TableCell className="font-mono font-medium">
                  {fee.wilaya_code}
                </TableCell>
                <TableCell>{fee.wilaya_name}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={getDisplayValue(fee, 'home')}
                    onChange={(e) => handleFeeChange(fee.id, 'home', e.target.value)}
                    className="w-full text-right"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={getDisplayValue(fee, 'desk')}
                    onChange={(e) => handleFeeChange(fee.id, 'desk', e.target.value)}
                    className="w-full text-right"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={hasChanges(fee) ? 'default' : 'ghost'}
                    disabled={!hasChanges(fee) || savingId === fee.id}
                    onClick={() => handleSave(fee)}
                    className="w-full"
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
