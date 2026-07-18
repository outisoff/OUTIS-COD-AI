import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Upload, Trash2, MoreHorizontal, AlertTriangle, Ban, Shield, History } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Package, PhoneCall, ShieldX, Wrench, Truck, CheckCircle, RotateCcw, TrendingUp, UserPlus, ShieldCheck, AlertTriangle as TriangleAlert } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ImportCustomersDialog } from '@/components/customers/ImportCustomersDialog';
import { AddCustomerDialog } from '@/components/customers/AddCustomerDialog';
import { CustomerOrderHistoryDialog } from '@/components/customers/CustomerOrderHistoryDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomers, useDeleteCustomer, useUpdateCustomer } from '@/hooks/useCustomers';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getWilayaLabel } from '@/data/algeriaLocations';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { phoneMatchesQuery } from '@/lib/phoneSearch';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useReturnRiskData } from '@/hooks/useReturnRisk';

function StatRow({ icon: Icon, label, value, colorClass }: { icon: React.ElementType; label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className={`flex items-center justify-center w-5 h-5 rounded ${colorClass}`}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-muted-foreground text-xs flex-1">{label}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<{ phone: string; name: string } | null>(null);
  const { data: customers, isLoading } = useCustomers();
  const deleteCustomer = useDeleteCustomer();
  const updateCustomer = useUpdateCustomer();

  const phoneNumbers = useMemo(() => {
    if (!customers) return [];
    return [...new Set(customers.map(c => c.phone).filter(Boolean))];
  }, [customers]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);
  const riskMap = useReturnRiskData();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const statusConfig = {
    new: { label: 'Nouveau', className: 'bg-primary/10 text-primary' },
    regular: { label: 'Régulier', className: 'bg-chart-6/10 text-chart-6' },
    vip: { label: 'VIP', className: 'bg-success/10 text-success' },
    blacklisted: { label: 'Blacklisté', className: 'bg-destructive/10 text-destructive' },
    at_risk: { label: 'À risque', className: 'bg-warning/10 text-warning' },
  };

  const handleStatusChange = (id: string, status: string) => {
    updateCustomer.mutate({ id, status: status as any }, {
      onSuccess: () => toast.success('Statut client mis à jour'),
      onError: () => toast.error('Erreur lors de la mise à jour'),
    });
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchQuery.trim()) return customers;
    
    const query = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(query) ||
      phoneMatchesQuery(c.phone, query) ||
      getWilayaLabel(c.wilaya).toLowerCase().includes(query) ||
      (c.commune && c.commune.toLowerCase().includes(query))
    );
  }, [customers, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-6 pt-6 pb-2">
        <div className="page-header">
          <h1 className="page-title">Clients</h1>
          <p className="page-description">
            Base de données clients et historique d'achats ({customers?.length || 0} total)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer Excel
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter Client
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 flex-shrink-0 px-6 pb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input 
            placeholder="Rechercher par nom, téléphone, wilaya..." 
            className="pl-10 h-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </Button>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredCustomers.length > 0 ? (
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b sticky top-0 z-20 bg-border">
              <tr className="border-b border-border transition-colors [&_th]:text-foreground [&_th]:font-semibold">
                <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Client</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Téléphone</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Wilaya</th>
                <th className="h-12 px-4 text-right align-middle font-semibold text-muted-foreground">Commandes</th>
                <th className="h-12 px-4 text-right align-middle font-semibold text-muted-foreground">Total Dépensé</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Dernière Commande</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Statut</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-24">Action</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
                {filteredCustomers.map((customer) => {
                  const status = statusConfig[customer.status as keyof typeof statusConfig] || statusConfig.new;
                  
                  return (
                    <tr key={customer.id} className="border-b transition-colors hover:bg-muted/50 cursor-pointer">
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-medium">{customer.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.commune || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                          <WhatsAppPhoneIndicator phone={customer.phone} whatsappStatus={whatsappStatus} />
                      </td>
                      <td className="p-4 align-middle text-sm">{getWilayaLabel(customer.wilaya)}</td>
                      <td className="p-4 align-middle text-right text-sm font-medium">{riskMap.get(customer.phone)?.totalOrders ?? customer.total_orders}</td>
                      <td className="p-4 align-middle text-right text-sm font-medium">
                        {formatCurrency(Number(customer.total_spent))}
                      </td>
                      <td className="p-4 align-middle text-sm text-muted-foreground">
                        {customer.last_order_date 
                          ? format(new Date(customer.last_order_date), 'dd MMM yyyy', { locale: fr })
                          : '-'
                        }
                      </td>
                      <td className="p-4 align-middle">
                        {(() => {
                          const risk = riskMap.get(customer.phone);
                          const riskLevel = risk?.riskLevel || 'nouveau';
                          const badgeStyles: Record<string, string> = {
                            nouveau: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                            faible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            moyen: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                            'élevé': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          };
                          const labels: Record<string, string> = { nouveau: 'Nouveau', faible: 'Faible', moyen: 'Moyen', 'élevé': 'Élevé' };
                          const riskIcons: Record<string, React.ElementType> = { nouveau: UserPlus, faible: ShieldCheck, moyen: TriangleAlert, 'élevé': ShieldX };
                          const RiskIcon = riskIcons[riskLevel] || UserPlus;
                          const ratePercent = risk ? Math.round(risk.returnRate * 100) : 0;
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${badgeStyles[riskLevel]}`}>
                                  <RiskIcon className="h-3 w-3" />
                                  {labels[riskLevel]}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-60 p-3" side="left" align="start">
                                <div className="space-y-1">
                                  {risk && <>
                                    <StatRow icon={Package} label="Total commandes" value={risk.totalOrders} colorClass="text-foreground" />
                                    <StatRow icon={PhoneCall} label="En confirmation" value={risk.inConfirmation} colorClass="text-blue-600" />
                                    <StatRow icon={ShieldX} label="Échecs" value={risk.returnedOrders} colorClass="text-destructive" />
                                    <StatRow icon={Wrench} label="En préparation" value={risk.inPreparation} colorClass="text-purple-600" />
                                    <StatRow icon={Truck} label="En livraison" value={risk.inDelivery} colorClass="text-orange-600" />
                                    <StatRow icon={CheckCircle} label="Livrées" value={risk.deliveredOrders} colorClass="text-green-600" />
                                    <StatRow icon={RotateCcw} label="Retours" value={risk.returnedCount} colorClass="text-orange-600" />
                                    <div className="border-t border-border my-1.5" />
                                    <div className="flex items-center gap-2 py-0.5">
                                      <div className="flex items-center justify-center w-5 h-5 rounded text-foreground">
                                        <TrendingUp className="h-3 w-3" />
                                      </div>
                                      <span className="text-muted-foreground text-xs flex-1">Taux de retour</span>
                                      <span className={`text-xs font-bold ${ratePercent >= 80 ? 'text-destructive' : ratePercent >= 20 ? 'text-orange-600' : 'text-green-600'}`}>{ratePercent}%</span>
                                    </div>
                                  </>}
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); setHistoryCustomer({ phone: customer.phone, name: customer.name }); }} title="Historique commandes">
                            <History className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {customer.status !== 'at_risk' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(customer.id, 'at_risk')}>
                                  <AlertTriangle className="h-4 w-4 mr-2 text-warning" />
                                  Marquer à risque
                                </DropdownMenuItem>
                              )}
                              {customer.status !== 'blacklisted' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(customer.id, 'blacklisted')}>
                                  <Ban className="h-4 w-4 mr-2 text-destructive" />
                                  Blacklister
                                </DropdownMenuItem>
                              )}
                              {(customer.status === 'at_risk' || customer.status === 'blacklisted') && (
                                <DropdownMenuItem onClick={() => handleStatusChange(customer.id, 'regular')}>
                                  <Shield className="h-4 w-4 mr-2 text-success" />
                                  Rétablir
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(customer.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Aucun client trouvé</p>
          </div>
        )}
      </div>

      <ImportCustomersDialog open={importOpen} onOpenChange={setImportOpen} />
      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} />
      {historyCustomer && (
        <CustomerOrderHistoryDialog
          open={!!historyCustomer}
          onOpenChange={(open) => !open && setHistoryCustomer(null)}
          customerPhone={historyCustomer.phone}
          customerName={historyCustomer.name}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le client sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteCustomer.mutate(deleteId, {
                    onSuccess: () => toast.success('Client supprimé'),
                    onError: () => toast.error('Erreur lors de la suppression'),
                  });
                  setDeleteId(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
