import { useState, useMemo, useEffect } from 'react';
import { Search, Save, Loader2, RefreshCw, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useDeliveryCompanyFees, 
  useUpdateDeliveryCompanyFee, 
  useInitializeDeliveryCompanyFees,
  DeliveryCompanyFee 
} from '@/hooks/useDeliveryCompanyFees';
import { Skeleton } from '@/components/ui/skeleton';
import { algeriaWilayas } from '@/data/algeriaLocations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const DELIVERY_COMPANIES = [
  { id: 'RJ360', name: 'RJ360', color: 'bg-orange-500' },
  { id: 'ZR Express', name: 'ZR Express', color: 'bg-yellow-500' },
  { id: 'Maystro', name: 'Maystro', color: 'bg-blue-500' },
];

export function DeliveryCompanyFeesManager() {
  const [selectedCompany, setSelectedCompany] = useState(DELIVERY_COMPANIES[0].id);
  const { data: fees, isLoading } = useDeliveryCompanyFees(selectedCompany);
  const updateFee = useUpdateDeliveryCompanyFee();
  const initializeFees = useInitializeDeliveryCompanyFees();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editedFees, setEditedFees] = useState<Record<string, { home: number; desk: number; return: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isImportingTarifs, setIsImportingTarifs] = useState(false);

  // Initialize fees for selected company if empty
  useEffect(() => {
    if (!isLoading && fees && fees.length === 0) {
      const wilayas = algeriaWilayas.map(w => ({
        code: w.code.padStart(2, '0'),
        name: w.name,
      }));
      initializeFees.mutate({ deliveryCompany: selectedCompany, wilayas });
    }
  }, [isLoading, fees, selectedCompany]);

  // Reset edited fees when company changes
  useEffect(() => {
    setEditedFees({});
  }, [selectedCompany]);

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

  const handleFeeChange = (id: string, type: 'home' | 'desk' | 'return', value: string) => {
    const numValue = parseFloat(value) || 0;
    const fee = fees?.find(f => f.id === id);
    if (!fee) return;

    setEditedFees((prev) => ({
      ...prev,
      [id]: {
        home: type === 'home' ? numValue : (prev[id]?.home ?? fee.home_delivery_fee),
        desk: type === 'desk' ? numValue : (prev[id]?.desk ?? fee.stop_desk_fee),
        return: type === 'return' ? numValue : (prev[id]?.return ?? fee.return_fee),
      },
    }));
  };

  const getDisplayValue = (fee: DeliveryCompanyFee, type: 'home' | 'desk' | 'return') => {
    if (editedFees[fee.id]) {
      return type === 'home' ? editedFees[fee.id].home : type === 'desk' ? editedFees[fee.id].desk : editedFees[fee.id].return;
    }
    return type === 'home' ? fee.home_delivery_fee : type === 'desk' ? fee.stop_desk_fee : fee.return_fee;
  };

  const hasChanges = (fee: DeliveryCompanyFee) => {
    const edited = editedFees[fee.id];
    if (!edited) return false;
    return (
      edited.home !== fee.home_delivery_fee || edited.desk !== fee.stop_desk_fee || edited.return !== fee.return_fee
    );
  };

  const handleSave = async (fee: DeliveryCompanyFee) => {
    const edited = editedFees[fee.id];
    if (!edited) return;

    setSavingId(fee.id);
    try {
      await updateFee.mutateAsync({
        id: fee.id,
        home_delivery_fee: edited.home,
        stop_desk_fee: edited.desk,
        return_fee: edited.return,
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

  const handleInitialize = () => {
    const wilayas = algeriaWilayas.map(w => ({
      code: w.code.padStart(2, '0'),
      name: w.name,
    }));
    initializeFees.mutate({ deliveryCompany: selectedCompany, wilayas });
  };

  const handleImportTarifs = async () => {
    if (selectedCompany !== 'RJ360' && selectedCompany !== 'ZR Express') return;
    setIsImportingTarifs(true);
    try {
      const fnName = selectedCompany === 'RJ360' ? 'ecotrack-get-tarifs' : 'zr-express-get-tarifs';
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(fnName, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await queryClient.invalidateQueries({ queryKey: ['delivery-company-fees', selectedCompany] });
      toast.success(data?.message || 'Tarifs importés avec succès');
    } catch (error: any) {
      console.error('Import tarifs error:', error);
      toast.error(error?.message || `Erreur lors de l'import des tarifs ${selectedCompany}`);
    } finally {
      setIsImportingTarifs(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Company Tabs */}
      <Tabs value={selectedCompany} onValueChange={setSelectedCompany}>
        <div className="flex items-center justify-between">
          <TabsList>
            {DELIVERY_COMPANIES.map((company) => (
              <TabsTrigger 
                key={company.id} 
                value={company.id}
                className="gap-2"
              >
                <span className={`w-2 h-2 rounded-full ${company.color}`} />
                {company.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2">
            {(selectedCompany === 'RJ360' || selectedCompany === 'ZR Express') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportTarifs}
                disabled={isImportingTarifs}
              >
                {isImportingTarifs ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Importer tarifs {selectedCompany}
              </Button>
            )}
          </div>

        </div>

        {DELIVERY_COMPANIES.map((company) => (
          <TabsContent key={company.id} value={company.id} className="mt-4">
            {/* Search */}
            <div className="relative max-w-sm mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[80px]">Code</TableHead>
                        <TableHead>Wilaya</TableHead>
                        <TableHead className="w-[150px] text-right">Domicile (DA)</TableHead>
                        <TableHead className="w-[150px] text-right">Stop Desk (DA)</TableHead>
                        <TableHead className="w-[150px] text-right">Retour (DA)</TableHead>
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
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="50"
                              value={getDisplayValue(fee, 'return')}
                              onChange={(e) => handleFeeChange(fee.id, 'return', e.target.value)}
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
                    {fees && fees.length === 0 
                      ? "Cliquez sur 'Initialiser' pour ajouter les wilayas"
                      : "Aucune wilaya trouvée"
                    }
                  </p>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
