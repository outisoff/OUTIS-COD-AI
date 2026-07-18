import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, Package, Download, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { writeExcelFile } from '@/lib/excel';
import { supabase } from '@/integrations/supabase/client';

export interface ImportOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryCompany: string;
}

export interface ImportResult {
  orderId: string;
  status: 'pending' | 'importing' | 'success' | 'error';
  message?: string;
}

interface ImportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: ImportOrder[];
  onImport: (order: ImportOrder, onProgress: (result: ImportResult) => void) => Promise<void>;
  onComplete: () => void;
}

export function ImportProgressDialog({
  open,
  onOpenChange,
  orders,
  onImport,
  onComplete,
}: ImportProgressDialogProps) {
  const [results, setResults] = useState<Map<string, ImportResult>>(new Map());
  const [isImporting, setIsImporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const updateResult = (result: ImportResult) => {
    setResults(prev => {
      const next = new Map(prev);
      next.set(result.orderId, result);
      return next;
    });
  };

  useEffect(() => {
    if (open && orders.length > 0 && !isImporting && !isComplete) {
      const initialResults = new Map<string, ImportResult>();
      orders.forEach(order => {
        initialResults.set(order.id, { orderId: order.id, status: 'pending' });
      });
      setResults(initialResults);
      
      const runImport = async () => {
        setIsImporting(true);
        for (const order of orders) {
          setResults(prev => {
            const next = new Map(prev);
            next.set(order.id, { orderId: order.id, status: 'importing' });
            return next;
          });
          try {
            await onImport(order, updateResult);
            setResults(prev => {
              const next = new Map(prev);
              next.set(order.id, { orderId: order.id, status: 'success' });
              return next;
            });
          } catch (error) {
            setResults(prev => {
              const next = new Map(prev);
              next.set(order.id, {
                orderId: order.id,
                status: 'error',
                message: error instanceof Error ? error.message : 'Erreur inconnue',
              });
              return next;
            });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        setIsImporting(false);
        setIsComplete(true);
      };
      runImport();
    }
  }, [open, orders, onImport, isImporting, isComplete]);

  useEffect(() => {
    if (!open) {
      setResults(new Map());
      setIsImporting(false);
      setIsComplete(false);
    }
  }, [open]);

  const handleClose = () => {
    if (!isImporting) {
      onComplete();
      onOpenChange(false);
    }
  };

  const successCount = Array.from(results.values()).filter(r => r.status === 'success').length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;
  const progress = orders.length > 0 ? ((successCount + errorCount) / orders.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-0 shadow-2xl">
        {/* Gradient Header */}
        <div className={cn(
          "px-6 pt-6 pb-5 transition-all duration-500",
          isComplete
            ? "bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent"
            : isImporting
              ? "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
              : "bg-gradient-to-br from-muted/50 to-transparent"
        )}>
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-3 text-xl">
              {isImporting ? (
                <>
                  <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                  <div>
                    <div>Importation en cours</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      Veuillez patienter...
                    </p>
                  </div>
                </>
              ) : isComplete ? (
                <>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div>Importation terminée</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {successCount} commande(s) importée(s) avec succès
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div>Préparation de l'import</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {orders.length} commande(s) à traiter
                    </p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Progress Section */}
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Progression</span>
              <span className="font-semibold tabular-nums">
                {successCount + errorCount} / {orders.length}
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={progress} 
                className={cn(
                  "h-2.5 rounded-full",
                  isComplete ? "[&>div]:bg-emerald-500" : ""
                )} 
              />
            </div>
          </div>

          {/* Stats Pills */}
          <div className="flex gap-2 mt-4">
            {successCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600">{successCount} réussie(s)</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">{errorCount} échec(s)</span>
              </div>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="px-6 pb-2">
          <ScrollArea className="h-[280px] rounded-xl border bg-muted/30 mt-1">
            <div className="p-2 space-y-1.5">
              {orders.map(order => {
                const result = results.get(order.id);
                const status = result?.status || 'pending';
                
                return (
                  <div
                    key={order.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-300',
                      status === 'pending' && 'bg-background/60 border-transparent',
                      status === 'importing' && 'bg-primary/5 border-primary/20 shadow-sm shadow-primary/5',
                      status === 'success' && 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20',
                      status === 'error' && 'bg-destructive/5 border-destructive/20',
                    )}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                      status === 'pending' && 'bg-muted',
                      status === 'importing' && 'bg-primary/10',
                      status === 'success' && 'bg-emerald-500/10',
                      status === 'error' && 'bg-destructive/10',
                    )}>
                      {status === 'pending' && <Package className="h-3.5 w-3.5 text-muted-foreground" />}
                      {status === 'importing' && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
                      {status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                      {status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {order.orderNumber.replace('ORD-', '').slice(-8)}
                        </span>
                        <span className="text-sm font-medium truncate">{order.customerName}</span>
                      </div>
                      {result?.message && (
                        <p className="text-xs text-destructive mt-0.5 truncate">{result.message}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-muted/80 text-muted-foreground whitespace-nowrap">
                      {order.deliveryCompany}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        {isComplete && (
          <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-2">
            <ExportToExcelButton orders={orders} results={results} />
            <Button onClick={handleClose} className="px-6">
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportToExcelButton({ 
  orders, 
  results 
}: { 
  orders: ImportOrder[]; 
  results: Map<string, ImportResult>;
}) {
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const successfulOrderIds = orders
        .filter(o => results.get(o.id)?.status === 'success')
        .map(o => o.id);
      
      if (successfulOrderIds.length === 0) {
        setIsExporting(false);
        return;
      }
      
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          order_number, customer_name, customer_phone, customer_address,
          wilaya, commune, delivery_type, delivery_company, delivery_fee,
          total_price, tracking_number, notes, status,
          order_items (product_name, quantity, unit_price, variant)
        `)
        .in('id', successfulOrderIds);
      
      if (error) throw error;
      
      const excelData = ordersData?.map(order => {
        const products = order.order_items
          ?.map(item => `${item.product_name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity}`)
          .join(', ') || '';
        
        return {
          'N° Commande': order.order_number,
          'Client': order.customer_name,
          'Téléphone': order.customer_phone,
          'Adresse': order.customer_address,
          'Wilaya': order.wilaya,
          'Commune': order.commune || '',
          'Type Livraison': order.delivery_type === 'home' ? 'Domicile' : 'Stop Desk',
          'Société Livraison': order.delivery_company || '',
          'Produits': products,
          'Frais Livraison': order.delivery_fee,
          'Total': order.total_price,
          'N° Suivi': order.tracking_number || '',
          'Notes': order.notes || '',
        };
      }) || [];
      
      const date = new Date().toISOString().split('T')[0];
      await writeExcelFile([{ name: 'Commandes Importées', data: excelData }], `commandes_importees_${date}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    } finally {
      setIsExporting(false);
    }
  }, [orders, results]);
  
  const successCount = Array.from(results.values()).filter(r => r.status === 'success').length;
  if (successCount === 0) return null;
  
  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting} className="gap-2">
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Télécharger Excel ({successCount})
    </Button>
  );
}
