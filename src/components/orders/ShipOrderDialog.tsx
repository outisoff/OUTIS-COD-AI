import { useState } from 'react';
import { Loader2, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { useIntegrations, DELIVERY_COMPANIES } from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { DeliveryCompanyBadge } from './DeliveryCompanyBadge';

interface ShipOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
}

export function ShipOrderDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
}: ShipOrderDialogProps) {
  const queryClient = useQueryClient();
  const { data: integrations } = useIntegrations('delivery');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [isShipping, setIsShipping] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; tracking_number?: string } | null>(null);

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

  // Get enabled delivery companies
  const enabledCompanies = integrations?.filter(i => i.is_enabled) || [];
  
  // Include custom companies
  const customCompanies = enabledCompanies
    .map(i => i.name)
    .filter(name => !DELIVERY_COMPANIES.includes(name as typeof DELIVERY_COMPANIES[number]));
  
  const allAvailableCompanies = [
    ...DELIVERY_COMPANIES.filter(c => enabledCompanies.some(i => i.name === c)),
    ...customCompanies,
  ];

  const hasAnyOption = allAvailableCompanies.length > 0 || (localLivreurs && localLivreurs.length > 0);

  const handleShip = async () => {
    if (!selectedCompany) {
      toast.error('Veuillez sélectionner une société de livraison');
      return;
    }

    setIsShipping(true);
    setResult(null);

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter');
        setIsShipping(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('ship-order', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          order_id: orderId,
          delivery_company: selectedCompany,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast.success(`Commande expédiée! Tracking: ${data.tracking_number}`);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error shipping order:', error);
      const errorResult = { success: false, message: 'Erreur lors de l\'expédition' };
      setResult(errorResult);
      toast.error(errorResult.message);
    } finally {
      setIsShipping(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setSelectedCompany('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Expédier la commande
          </DialogTitle>
          <DialogDescription>
            Envoyez la commande <strong>{orderNumber}</strong> à une société de livraison.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <p className="text-sm text-muted-foreground">{customerName}</p>
          </div>

          <div className="space-y-2">
            <Label>Société de livraison *</Label>
            {hasAnyOption ? (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une société..." />
                </SelectTrigger>
                <SelectContent>
                  {allAvailableCompanies.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Sociétés de livraison</SelectLabel>
                      {allAvailableCompanies.map((company) => (
                        <SelectItem key={company} value={company}>
                          <DeliveryCompanyBadge company={company} size="sm" />
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
                          <SelectItem key={livreur.id} value={`local:${livreur.name}`}>
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

          {result && (
            <div className={`flex items-start gap-3 p-3 rounded-md ${
              result.success 
                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">{result.message}</p>
                {result.tracking_number && (
                  <p className="text-sm">
                    Numéro de suivi: <strong>{result.tracking_number}</strong>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result?.success ? 'Fermer' : 'Annuler'}
          </Button>
          {!result?.success && (
            <Button 
              onClick={handleShip} 
              disabled={isShipping || !hasAnyOption}
            >
              {isShipping ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Truck className="h-4 w-4 mr-2" />
              )}
              Expédier
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
