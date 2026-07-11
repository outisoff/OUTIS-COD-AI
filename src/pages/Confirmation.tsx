import { useState, useMemo, useCallback } from 'react';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { ChatPanel } from '@/components/orders/ChatPanel';
import { format } from 'date-fns';
import { ReturnRiskBadge } from '@/components/orders/ReturnRiskBadge';
import { useReturnRiskData } from '@/hooks/useReturnRisk';
import { Phone, CheckCircle, XCircle, Clock, MessageCircle, ChevronDown, Home, Building2, AlertTriangle, Calendar, RefreshCw, List, Search, User, MapPin, Truck, Package } from 'lucide-react';
import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';
import { WhatsAppChatButton } from '@/components/orders/WhatsAppChatButton';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { DeliveryCompanyBadge } from '@/components/orders/DeliveryCompanyBadge';
import { StopDeskInfoPopover } from '@/components/orders/StopDeskInfoPopover';
import { SuiviPopover } from '@/components/orders/SuiviPopover';
import { StatusHistoryPopover } from '@/components/orders/StatusHistoryPopover';
import { phoneMatchesQuery } from '@/lib/phoneSearch';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { OrderStatusBadge, allOrderStatuses, getStatusButtonClassName } from '@/components/orders/OrderStatusBadge';
import { EditOrderDialog } from '@/components/orders/EditOrderDialog';
import { useUpdateOrderStatus, OrderWithItems } from '@/hooks/useOrders';
import { useConfirmationOrders } from '@/hooks/useConfirmationOrders';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getOrderErrorMessage } from '@/lib/errorMessages';
import { getWilayaLabel } from '@/data/algeriaLocations';

type FilterStatus = 'all' | 'new' | 'confirmed' | 'failed' | 'postponed' | 'cancelled' | 'error';

const DELIVERY_COMPANIES = ['RJ360', 'ZR Express', 'Maystro'] as const;

// Move constants outside component to prevent recreation on each render
const CONFIRMATION_ONLY_STATUSES = [
  'new', 'validated', 'confirmed', 'cancelled', 'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6',
  'no_answer', 'wrong_number', 'postponed', 'to_reconfirm', 'callback', 'duplicate', 'out_of_stock', 'erreur'
] as const;

const STATUS_MAP: Record<FilterStatus, string[]> = {
  all: [],
  new: ['new', 'validated'],
  confirmed: ['confirmed'],
  failed: ['failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5'],
  postponed: ['postponed', 'to_reconfirm', 'callback'],
  cancelled: ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'],
  error: ['erreur'],
};

const confirmationStatuses = allOrderStatuses.filter(s => 
  !['ready', 'preparing', 'to_station', 'at_station', 'au_bureau', 'shipped', 'delivered', 'erreur', 'Échec_de_livraison', 'en_livraison', 'alerte'].includes(s.value)
);

const NEW_ORDER_ALLOWED_STATUSES = [
  'validated', 'confirmed', 'cancelled', 'failed_1', 'wrong_number',
  'postponed', 'to_reconfirm', 'callback', 'duplicate', 'out_of_stock'
];

const CONFIRMED_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'failed_1',
  'postponed', 'to_reconfirm', 'callback', 'duplicate', 'out_of_stock'
];

const FAILED1_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'failed_2', 'wrong_number',
  'postponed', 'to_reconfirm', 'callback', 'duplicate'
];

const FAILED2_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'failed_3', 'wrong_number',
  'postponed', 'to_reconfirm', 'callback', 'duplicate'
];


const FAILED3_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'failed_4', 'wrong_number',
  'postponed', 'to_reconfirm', 'callback', 'duplicate'
];

const FAILED4_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'failed_5', 'wrong_number',
  'postponed', 'to_reconfirm', 'callback', 'duplicate'
];

const FAILED5_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'no_answer', 'wrong_number',
  'postponed', 'to_reconfirm', 'callback', 'duplicate'
];

const POSTPONED_ALLOWED_STATUSES = [
  'confirmed', 'cancelled', 'failed_1', 'postponed',
  'to_reconfirm', 'callback'
];

const getStatusOptionsForOrder = (currentStatus: string) => {
  if (currentStatus === 'new') {
    return confirmationStatuses.filter(s => NEW_ORDER_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'validated') {
    return confirmationStatuses.filter(s => NEW_ORDER_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'confirmed') {
    return confirmationStatuses.filter(s => CONFIRMED_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'failed_1') {
    return confirmationStatuses.filter(s => FAILED1_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'failed_2') {
    return confirmationStatuses.filter(s => FAILED2_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'failed_3') {
    return confirmationStatuses.filter(s => FAILED3_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'failed_4') {
    return confirmationStatuses.filter(s => FAILED4_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'failed_5') {
    return confirmationStatuses.filter(s => FAILED5_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'postponed') {
    return confirmationStatuses.filter(s => POSTPONED_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'to_reconfirm') {
    return confirmationStatuses.filter(s => POSTPONED_ALLOWED_STATUSES.includes(s.value));
  }
  if (currentStatus === 'callback') {
    return confirmationStatuses.filter(s => POSTPONED_ALLOWED_STATUSES.includes(s.value));
  }
  return confirmationStatuses;
};




export default function Confirmation() {
  // useOrdersRealtime moved to MainLayout
  const riskMap = useReturnRiskData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedStoreId } = useStoreFilter();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryCompanyFilter, setDeliveryCompanyFilter] = useState<string[]>([]);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  const { data: allOrders, isLoading } = useConfirmationOrders(selectedStoreId);
  const { data: confirmationLogs } = useAutoConfirmationLogs();
  const [globalManualMode, setGlobalManualMode] = useState(false);
  const toggleGlobalManual = useCallback(() => setGlobalManualMode(prev => !prev), []);
  const updateStatus = useUpdateOrderStatus();

  const phoneNumbers = useMemo(() => {
    if (!allOrders) return [];
    return [...new Set(allOrders.map(o => o.customer_phone).filter(Boolean))] as string[];
  }, [allOrders]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);

  // Calculate counts for each filter category - optimized single pass
  const { statusCounts, confirmationTotalCount } = useMemo(() => {
    if (!allOrders) return { 
      statusCounts: { new: 0, confirmed: 0, failed: 0, postponed: 0, cancelled: 0, error: 0 },
      confirmationTotalCount: 0
    };
    
    const counts = { new: 0, confirmed: 0, failed: 0, postponed: 0, cancelled: 0, error: 0 };
    let totalCount = 0;
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const cancelledStatuses = ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'];
    const failedStatuses = ['failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5'];
    
    for (const o of allOrders) {
      if (!CONFIRMATION_ONLY_STATUSES.includes(o.status as typeof CONFIRMATION_ONLY_STATUSES[number])) continue;
      
      // Skip cancelled orders older than 24h
      if (cancelledStatuses.includes(o.status) && (now - new Date(o.updated_at).getTime()) > TWENTY_FOUR_HOURS) continue;
      
      totalCount++;
      
      if (o.status === 'new' || o.status === 'validated') counts.new++;
      else if (o.status === 'confirmed') counts.confirmed++;
      else if (failedStatuses.includes(o.status)) counts.failed++;
      else if (o.status === 'postponed' || o.status === 'to_reconfirm' || o.status === 'callback') counts.postponed++;
      else if (cancelledStatuses.includes(o.status)) counts.cancelled++;
      else if (o.status === 'erreur') counts.error++;
    }
    
    return { statusCounts: counts, confirmationTotalCount: totalCount };
  }, [allOrders]);

  // Filter orders based on active filter and search - optimized
  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    
    const query = searchQuery.trim().toLowerCase();
    const statusFilter = activeFilter !== 'all' ? STATUS_MAP[activeFilter] : null;
    
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const cancelledStatuses = ['cancelled', 'no_answer', 'wrong_number', 'duplicate', 'out_of_stock'];
    const result: OrderWithItems[] = [];
    
    for (const o of allOrders) {
      if (!CONFIRMATION_ONLY_STATUSES.includes(o.status as typeof CONFIRMATION_ONLY_STATUSES[number])) continue;
      
      // Hide cancelled orders older than 24h
      if (cancelledStatuses.includes(o.status) && (now - new Date(o.updated_at).getTime()) > TWENTY_FOUR_HOURS) continue;
      
      // Apply status filter
      if (statusFilter && !statusFilter.includes(o.status)) continue;
      
      // Apply delivery company filter
      if (deliveryCompanyFilter.length > 0 && (!o.delivery_company || !deliveryCompanyFilter.includes(o.delivery_company))) continue;
      
      // Apply delivery type filter
      if (deliveryTypeFilter !== 'all' && o.delivery_type !== deliveryTypeFilter) continue;

      // Apply search filter
      if (query) {
        const matchesSearch = 
          o.order_number.toLowerCase().includes(query) ||
          o.customer_name.toLowerCase().includes(query) ||
          phoneMatchesQuery(o.customer_phone, query) ||
          getWilayaLabel(o.wilaya).toLowerCase().includes(query) ||
          o.order_items.some(item => item.product_name.toLowerCase().includes(query));
        
        if (!matchesSearch) continue;
      }
      
      result.push(o);
    }
    
    // Sort: "tous" shows newest first; all other tabs use FIFO (oldest first)
    if (activeFilter === 'all') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // FIFO: oldest first by created_at
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    
    return result;
  }, [allOrders, activeFilter, searchQuery, deliveryCompanyFilter, deliveryTypeFilter]);

  // Memoize filterTabs to prevent recreation on each render
  const filterTabs = useMemo(() => [
    { key: 'all' as FilterStatus, label: 'Tous', icon: List, count: confirmationTotalCount, color: 'bg-slate-600' },
    { key: 'new' as FilterStatus, label: 'Nouveau', icon: Phone, count: statusCounts.new, color: 'bg-blue-500' },
    { key: 'confirmed' as FilterStatus, label: 'Confirmé', icon: CheckCircle, count: statusCounts.confirmed, color: 'bg-green-500' },
    { key: 'failed' as FilterStatus, label: 'Échoués', icon: AlertTriangle, count: statusCounts.failed, color: 'bg-amber-500' },
    { key: 'postponed' as FilterStatus, label: 'Reporté', icon: Calendar, count: statusCounts.postponed, color: 'bg-purple-500' },
    { key: 'error' as FilterStatus, label: 'Erreur', icon: AlertTriangle, count: statusCounts.error, color: 'bg-red-600' },
    { key: 'cancelled' as FilterStatus, label: 'Annulé', icon: XCircle, count: statusCounts.cancelled, color: 'bg-red-500' },
  ], [statusCounts, confirmationTotalCount]);
  
  // Memoize agentStats
  const agentStats = useMemo(() => ({
    assigned: allOrders?.length || 0,
    confirmed: statusCounts.confirmed,
    cancelled: statusCounts.cancelled,
    pending: statusCounts.new + statusCounts.failed + statusCounts.postponed + statusCounts.error,
    targetToday: 30,
  }), [allOrders?.length, statusCounts]);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  }, []);

  const handleStatusChange = useCallback(async (order: OrderWithItems, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        status: newStatus as any,
      });
      toast({
        title: 'Statut mis à jour',
        description: `Commande ${order.order_number} → ${allOrderStatuses.find(s => s.value === newStatus)?.label}`,
      });

      // Auto-import to delivery company when status changes to "preparing"
      // ZR Express is handled by backend trigger on status=preparing.
      if (newStatus === 'preparing' && !order.tracking_number) {
        const company = order.delivery_company;
        const functionName = company === 'RJ360' ? 'ecotrack-create-order' : '';

        if (functionName) {
          try {
            const { data, error } = await supabase.functions.invoke(functionName, {
              body: { record: { ...order, status: 'preparing' } },
            });
            if (error) {
              console.error(`${company} auto-import error:`, error);
              toast({
                title: 'Avertissement',
                description: `Statut mis à jour mais erreur d'import ${company}: ${error.message}`,
                variant: 'destructive',
              });
            } else if (data?.success) {
              toast({
                title: `📦 Importé vers ${company}`,
                description: `Tracking: ${data.tracking_number}`,
              });
              queryClient.invalidateQueries({ queryKey: ['orders-confirmation'] });
            } else if (data?.error) {
              toast({
                title: `Erreur ${company}`,
                description: data.error,
                variant: 'destructive',
              });
            }
          } catch (importError) {
            console.error(`${company} import failed:`, importError);
          }
        }
      }
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: getOrderErrorMessage(error),
        variant: 'destructive',
      });
    }
  }, [updateStatus, toast, queryClient]);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in gap-4 overflow-hidden">


      {/* Search and Status Filter */}
      <Card className="p-4 flex-shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Rechercher par N°, nom, téléphone, wilaya, produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            {/* Combined Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 min-w-[120px] justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    Filtre
                    {(deliveryCompanyFilter.length > 0 || deliveryTypeFilter !== 'all') && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {(deliveryCompanyFilter.length > 0 ? 1 : 0) + (deliveryTypeFilter !== 'all' ? 1 : 0)}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <div className="grid grid-cols-2 divide-x divide-border">
                  {/* Left: Société */}
                  <div className="p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Société</div>
                    <div className="space-y-1">
                      {DELIVERY_COMPANIES.map((company) => {
                        const isChecked = deliveryCompanyFilter.includes(company);
                        const iconColor = company === 'RJ360' ? 'text-orange-500' : company === 'ZR Express' ? 'text-amber-500' : 'text-blue-500';
                        const bgActive = company === 'RJ360' ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : company === 'ZR Express' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
                        return (
                          <label
                            key={company}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer transition-all duration-150 ${isChecked ? bgActive : 'border-transparent hover:bg-muted/60'}`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDeliveryCompanyFilter([...deliveryCompanyFilter, company]);
                                } else {
                                  setDeliveryCompanyFilter(deliveryCompanyFilter.filter(c => c !== company));
                                }
                              }}
                            />
                            <Truck className={`h-4 w-4 ${iconColor}`} />
                            <span className="text-sm font-medium">{company}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {/* Right: Type de livraison */}
                  <div className="p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Type</div>
                    <div className="space-y-1">
                      {[
                        { value: 'all', label: 'Toutes', icon: Package, color: 'text-muted-foreground', bgActive: 'bg-muted border-border' },
                        { value: 'home', label: 'À domicile', icon: Home, color: 'text-blue-500', bgActive: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
                        { value: 'stop_desk', label: 'Stop Desk', icon: Building2, color: 'text-violet-500', bgActive: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800' },
                      ].map((type) => {
                        const TypeIcon = type.icon;
                        const isActive = deliveryTypeFilter === type.value;
                        return (
                          <button
                            key={type.value}
                            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border text-left transition-all duration-150 ${isActive ? type.bgActive : 'border-transparent hover:bg-muted/60'}`}
                            onClick={() => setDeliveryTypeFilter(type.value)}
                          >
                            <TypeIcon className={`h-4 w-4 ${isActive ? type.color : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{type.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {(deliveryCompanyFilter.length > 0 || deliveryTypeFilter !== 'all') && (
                  <div className="border-t px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => { setDeliveryCompanyFilter([]); setDeliveryTypeFilter('all'); }}
                    >
                      Effacer tous les filtres
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-x-auto">
              {filterTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(isActive ? 'all' : tab.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      isActive 
                        ? 'bg-muted text-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${tab.color}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Orders Queue - Spreadsheet Style */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 min-h-0">
          <div key={activeFilter} className="h-full animate-tab-fade-in">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="h-full overflow-auto">
              <div className="min-w-[1200px]">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b sticky top-0 z-20 bg-border">
                    <tr className="border-b border-border transition-colors [&_th]:text-foreground [&_th]:font-semibold">
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">N° Commande</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[180px]">Informations destinataire</th>
                      <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[180px]">Adresse destinataire</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Produit</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Total</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Type Livraison</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[140px]">Statut</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[120px]">Remarque</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <TableBody>
                    {filteredOrders.map((order, index) => (
                      <TableRow 
                        key={order.id} 
                        className={`
                          hover:bg-muted/30 transition-colors [&_td]:py-[3.5px]
                          ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                        `}
                      >
                        <TableCell className="text-center">
                          <div className="font-mono text-[15px] font-bold text-primary">
                            ORD-{order.order_number.replace(/\D/g, '').padStart(5, '0').slice(-5)}
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {format(new Date(order.created_at), 'dd-MMM-yy')}
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {format(new Date(order.created_at), 'HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="p-2 pl-4 space-y-1 text-sm inline-block text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium">{order.customer_name}</span>
                              <WhatsAppPhoneIndicator phone={order.customer_phone} whatsappStatus={whatsappStatus} />
                            </div>
                            {(() => { const risk = riskMap.get(order.customer_phone); const isDup = risk && risk.activeOrderIds.length > 1; return risk ? <ReturnRiskBadge riskLevel={risk.riskLevel} returnRate={risk.returnRate} totalOrders={risk.totalOrders} returnedOrders={risk.returnedOrders} deliveryFailures={risk.deliveryFailures} deliveredOrders={risk.deliveredOrders} returnedCount={risk.returnedCount} inConfirmation={risk.inConfirmation} inPreparation={risk.inPreparation} inDelivery={risk.inDelivery} cancelledOrders={risk.cancelledOrders} isDuplicate={isDup} duplicateCount={risk.activeOrderIds.length} customerPhone={order.customer_phone} customerName={order.customer_name} /> : null; })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="p-2 space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium">{getWilayaLabel(order.wilaya)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-muted-foreground">{order.commune || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-muted-foreground truncate max-w-[140px]" title={order.customer_address?.replace(/^Stop Desk:\s*/, '')}>
                                {order.customer_address?.replace(/^Stop Desk:\s*/, '') || '-'}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="flex flex-col items-center gap-0.5" title={order.order_items.map(i => `${i.product_name} x${i.quantity}`).join(', ')}>
                            {[...order.order_items].sort((a, b) => {
                              const aGift = a.variant === 'cadeau' ? 1 : 0;
                              const bGift = b.variant === 'cadeau' ? 1 : 0;
                              if (aGift !== bGift) return aGift - bGift;
                              return (b.quantity || 0) - (a.quantity || 0);
                            }).map((item) => (
                              <div key={item.id} className={`text-sm truncate ${item.variant === 'cadeau' ? 'text-green-600' : ''}`}>
                                {item.product_name}{item.variant && item.variant !== 'cadeau' ? ` (${item.variant})` : ''} <span className={`font-medium ${item.variant === 'cadeau' ? 'text-green-600' : 'text-primary'}`}>x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {formatCurrency(Number(order.total_price))}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StopDeskInfoPopover order={order}>
                              <Badge 
                                variant="outline" 
                                className={`text-xs px-2 py-1 w-[100px] justify-center cursor-pointer ${
                                  order.delivery_type === 'stop_desk' 
                                    ? 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 transition-colors' 
                                    : 'bg-blue-100 text-blue-700 border-blue-300'
                                }`}
                              >
                                {order.delivery_type === 'stop_desk' ? (
                                  <><Building2 className="h-3 w-3 mr-1" />Stop Desk</>
                                ) : (
                                  <><Home className="h-3 w-3 mr-1" />À Domicile</>
                                )}
                              </Badge>
                            </StopDeskInfoPopover>
                            {order.delivery_company && (
                              <DeliveryCompanyBadge company={order.delivery_company} trackingNumber={order.tracking_number} className="text-xs px-2 py-1 w-[100px] justify-center" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            {activeFilter === 'all' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                title="Sélectionnez un filtre (Nouveau, Confirmé...) pour modifier le statut"
                                className={`w-full justify-center text-xs h-8 disabled:opacity-100 cursor-not-allowed ${getStatusButtonClassName(order.status as any)}`}
                              >
                                <span className="truncate">
                                  {allOrderStatuses.find(s => s.value === order.status)?.label}
                                </span>
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className={`w-full justify-between text-xs h-8 ${getStatusButtonClassName(order.status as any)}`}
                                    disabled={updateStatus.isPending}
                                  >
                                    <span className="truncate pl-2">
                                      {allOrderStatuses.find(s => s.value === order.status)?.label}
                                    </span>
                                    <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-popover border border-border shadow-lg z-50 w-[180px]">
                                  <ScrollArea className="h-[300px]">
                                    {getStatusOptionsForOrder(order.status).map((statusOption) => (
                                      <DropdownMenuItem
                                        key={statusOption.value}
                                        onClick={() => handleStatusChange(order, statusOption.value)}
                                        className={order.status === statusOption.value ? 'bg-muted' : ''}
                                      >
                                        <OrderStatusBadge status={statusOption.value as any} />
                                      </DropdownMenuItem>
                                    ))}
                                  </ScrollArea>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <SuiviPopover order={order} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <StatusHistoryPopover order={order} />
                            <EditOrderDialog order={order as any} confirmationOnly />
                            <WhatsAppChatButton
                              order={order}
                              whatsappStatus={whatsappStatus}
                              confirmationLogs={confirmationLogs}
                              globalManualMode={globalManualMode}
                              onToggleGlobalManual={toggleGlobalManual}
                              onSheetClose={() => { if (globalManualMode) setGlobalManualMode(false); }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Toutes les commandes sont traitées!</p>
              <p className="text-muted-foreground">Aucune commande en attente de confirmation.</p>
            </div>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
