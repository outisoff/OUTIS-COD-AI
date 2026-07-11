import { useState, useEffect } from 'react';
import { Loader2, Truck, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { DeliveryCompanyBadge } from './DeliveryCompanyBadge';
import { useIntegrations, DELIVERY_COMPANIES } from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface OrderInfo {
  id: string;
  orderNumber: string;
  customerName: string;
}

interface ShipResult {
  orderId: string;
  orderNumber: string;
  success: boolean;
  message: string;
  trackingNumber?: string;
}

interface BulkShipOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderInfo[];
  onComplete: () => void;
}

export function BulkShipOrderDialog({
  open,
  onOpenChange,
  orders,
  onComplete,
}: BulkShipOrderDialogProps) {
  const queryClient = useQueryClient();
  const { data: integrations } = useIntegrations('delivery');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [isShipping, setIsShipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ShipResult[]>([]);

  // Fetch local livreurs
  const { data: localLivreurs } = useQuery({
    queryKey: ['local_livreurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('local_livreurs')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Auto-close dialog if no orders to show
  useEffect(() => {
    if (open && orders.length === 0) {
      onOpenChange(false);
    }
  }, [open, orders.length, onOpenChange]);

  // Get enabled delivery companies + local livreurs
  const enabledCompanies = integrations?.filter(i => i.is_enabled) || [];
  const customCompanies = enabledCompanies
    .map(i => i.name)
    .filter(name => !DELIVERY_COMPANIES.includes(name as typeof DELIVERY_COMPANIES[number]));
  const allAvailableCompanies = [
    ...DELIVERY_COMPANIES.filter(c => enabledCompanies.some(i => i.name === c)),
    ...customCompanies,
  ];
  const hasAnyOption = allAvailableCompanies.length > 0 || (localLivreurs && localLivreurs.length > 0);

  // Get trigger styling based on selected company
  const getTriggerStyle = () => {
    if (!selectedCompany) return '';
    const name = selectedCompany.toLowerCase();
    if (name.includes('zr')) return 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100';
    if (name.includes('maystro')) return 'bg-blue-50 border-blue-300 hover:bg-blue-100';
    if (name.includes('rj360')) return 'bg-orange-50 border-orange-300 hover:bg-orange-100';
    return '';
  };

  // Get item hover styling
  const getItemHoverStyle = (company: string) => {
    const name = company.toLowerCase();
    if (name.includes('zr')) return 'hover:bg-yellow-50';
    if (name.includes('maystro')) return 'hover:bg-blue-50';
    if (name.includes('rj360')) return 'hover:bg-orange-50';
    return 'hover:bg-muted';
  };

  const handleBulkShip = async () => {
    if (!selectedCompany) {
      toast.error('Veuillez sélectionner une société de livraison');
      return;
    }

    setIsShipping(true);
    setResults([]);
    setProgress(0);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Veuillez vous connecter');
      setIsShipping(false);
      return;
    }

    const shipResults: ShipResult[] = [];

    // For RJ360 with multiple orders, use bulk create API (up to 100 per request)
    if (selectedCompany === 'RJ360' && orders.length > 1) {
      try {
        setProgress(10);
        const { data, error } = await supabase.functions.invoke('ecotrack-create-orders', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { order_ids: orders.map(o => o.id) },
        });

        if (error) throw error;

        // Map results back to individual orders
        const results = data?.results || {};
        for (const order of orders) {
          const result = Object.entries(results).find(
            ([ref]) => ref === order.orderNumber
          );
          if (result) {
            const [, res] = result as [string, any];
            shipResults.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              success: !!res.success,
              message: res.success ? 'Envoyé à RJ360' : JSON.stringify(res.errors || 'Erreur').substring(0, 100),
              trackingNumber: res.tracking,
            });
          } else {
            shipResults.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              success: false,
              message: 'Pas de résultat retourné',
            });
          }
        }
        setProgress(100);
        setResults([...shipResults]);
      } catch (error) {
        console.error('Bulk RJ360 error:', error);
        // Fallback to individual shipping
        for (const order of orders) {
          shipResults.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            message: 'Erreur envoi en masse RJ360',
          });
        }
        setProgress(100);
        setResults([...shipResults]);
      }
    } else {
      // Individual shipping for other carriers or single order
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        try {
          const { data, error } = await supabase.functions.invoke('ship-order', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: {
              order_id: order.id,
              delivery_company: selectedCompany,
            },
          });

          if (error) throw error;

          shipResults.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: data.success,
            message: data.message,
            trackingNumber: data.tracking_number,
          });
        } catch (error) {
          console.error(`Error shipping order ${order.orderNumber}:`, error);
          shipResults.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            message: 'Erreur lors de l\'expédition',
          });
        }

        setProgress(((i + 1) / orders.length) * 100);
        setResults([...shipResults]);
      }
    }

    const successCount = shipResults.filter(r => r.success).length;
    const failCount = shipResults.filter(r => !r.success).length;

    if (successCount > 0) {
      toast.success(`${successCount} commande(s) expédiée(s) avec succès`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
    if (failCount > 0) {
      toast.error(`${failCount} commande(s) en échec`);
    }

    setIsShipping(false);
  };

  const handleClose = () => {
    // Always call onComplete when import was attempted (results exist)
    if (results.length > 0) {
      onComplete();
    }
    setResults([]);
    setSelectedCompany('');
    setProgress(0);
    onOpenChange(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const isComplete = results.length === orders.length && results.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Importer {orders.length} commande(s)
          </DialogTitle>
          <DialogDescription>
            Envoyez les commandes sélectionnées à une société de livraison.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Orders list preview */}
          <div className="space-y-2">
            <Label>Commandes à expédier</Label>
            <ScrollArea className={`${results.some(r => !r.success) ? 'h-[200px]' : 'h-[120px]'} rounded-md border p-2`}>
              <div className="space-y-1">
                {orders.map((order) => {
                  const result = results.find(r => r.orderId === order.id);
                  return (
                    <div 
                      key={order.id}
                      className={`text-sm p-2 rounded ${
                        result 
                          ? result.success 
                            ? 'bg-green-500/10' 
                            : 'bg-destructive/10'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {result ? (
                            result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                            )
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-mono">{order.orderNumber}</span>
                          <span className="text-muted-foreground truncate">- {order.customerName}</span>
                        </div>
                        {result?.trackingNumber && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {result.trackingNumber}
                          </span>
                        )}
                      </div>
                      {result && !result.success && result.message && (
                        <p className="mt-1 ml-6 text-xs text-destructive break-words">
                          {result.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Company selection */}
          <div className="space-y-2">
            <Label>Société de livraison *</Label>
            {hasAnyOption ? (
              <Select 
                value={selectedCompany || undefined} 
                onValueChange={setSelectedCompany}
                disabled={isShipping || isComplete}
              >
                <SelectTrigger className={`w-full transition-all ${getTriggerStyle()}`}>
                  <SelectValue placeholder="🚚 Choisir une société...">
                    {selectedCompany && (
                      <DeliveryCompanyBadge company={selectedCompany.startsWith('local:') ? selectedCompany.replace('local:', '') : selectedCompany} className="ml-1" />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-xl z-[200] p-1">
                  {allAvailableCompanies.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Sociétés de livraison</SelectLabel>
                      {allAvailableCompanies.map((company) => (
                        <SelectItem 
                          key={company} 
                          value={company}
                          className={`cursor-pointer rounded-md my-0.5 transition-colors ${getItemHoverStyle(company)}`}
                        >
                          <DeliveryCompanyBadge company={company} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {localLivreurs && localLivreurs.length > 0 && (
                    <>
                      {allAvailableCompanies.length > 0 && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground">Livreurs locaux</SelectLabel>
                        {localLivreurs.map((livreur) => (
                          <SelectItem key={livreur.id} value={`local:${livreur.name}`} className="cursor-pointer rounded-md my-0.5">
                            <DeliveryCompanyBadge company={livreur.name} size="sm" />
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
                Aucune société de livraison configurée. Allez dans{' '}
                <strong>Paramètres → Intégrations</strong> pour en ajouter.
              </div>
            )}
          </div>

          {/* Progress bar */}
          {isShipping && (
            <div className="space-y-2">
              <Label>Progression</Label>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {results.length} / {orders.length} commande(s) traitée(s)
              </p>
            </div>
          )}

          {/* Results summary */}
          {isComplete && (
            <div className={`flex items-start gap-3 p-3 rounded-md ${
              failCount === 0 
                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                : successCount === 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
            }`}>
              {failCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {successCount} commande(s) expédiée(s)
                  {failCount > 0 && `, ${failCount} en échec`}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {isComplete ? 'Fermer' : 'Annuler'}
          </Button>
          {!isComplete && (
            <Button 
              onClick={handleBulkShip} 
              disabled={isShipping || !hasAnyOption || !selectedCompany}
            >
              {isShipping ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Truck className="h-4 w-4 mr-2" />
              )}
              Importer tout
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
