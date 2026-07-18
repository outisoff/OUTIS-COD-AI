import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ReturnRiskBadge } from '@/components/orders/ReturnRiskBadge';
import { useReturnRiskData } from '@/hooks/useReturnRisk';
import { Truck, Package, MapPin, CheckCircle, XCircle, Clock, MessageCircle, ChevronDown, Home, Building2, List, RotateCcw, DollarSign, AlertTriangle, RefreshCw, PackageCheck, Search, Plus, Send, User, Phone, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DeliveryCompanyBadge } from '@/components/orders/DeliveryCompanyBadge';
import { StopDeskInfoPopover } from '@/components/orders/StopDeskInfoPopover';
import { SuiviPopover } from '@/components/orders/SuiviPopover';
import { TrackingHistoryPopover } from '@/components/orders/TrackingHistoryPopover';
import { StatusHistoryPopover } from '@/components/orders/StatusHistoryPopover';
import { phoneMatchesQuery } from '@/lib/phoneSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { OrderStatusBadge, allOrderStatuses, getStatusButtonClassName } from '@/components/orders/OrderStatusBadge';
import { EditOrderDialog } from '@/components/orders/EditOrderDialog';
import { useUpdateOrderStatus, OrderWithItems } from '@/hooks/useOrders';
import { useTrackingOrders, useTrackingDeliveries } from '@/hooks/useTrackingOrders';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

import { writeExcelFile } from '@/lib/excel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const DELIVERY_COMPANIES = ['RJ360', 'ZR Express', 'Maystro'] as const;

type FilterStatus = 'all' | 'en_station' | 'en_livraison' | 'au_bureau' | 'delivered' | 'echec_livraison' | 'alerte';

import { ChatPanel } from '@/components/orders/ChatPanel';
import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';

function TrackingChatButton({
  order,
  whatsappStatus,
  confirmationLogs,
  log,
}: {
  order: OrderWithItems;
  whatsappStatus?: Record<string, boolean | null> | null;
  confirmationLogs?: any[];
  log?: any;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const isChecked = whatsappStatus && order.customer_phone in whatsappStatus;
  const noWhatsApp = isChecked && whatsappStatus[order.customer_phone] === false;

  if (noWhatsApp) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive cursor-not-allowed opacity-70"
            disabled
            title="Pas de WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ce numéro n'a pas WhatsApp</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={async (open) => {
      setSheetOpen(open);
      if (!open && log && log.conversation_status === 'manual_takeover') {
        await supabase.from('auto_confirmation_logs').update({ conversation_status: 'awaiting_reply' }).eq('id', log.id);
        queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
      }
    }}>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100" title="Chat WhatsApp">
          <MessageCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Chat - {order.customer_name}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{order.customer_phone} • {formatOrderNumber(order.order_number)}</p>
        </SheetHeader>
        <ChatPanel order={order} confirmationLogs={confirmationLogs} />
      </SheetContent>
    </Sheet>
  );
}

export default function Tracking() {
  // useOrdersRealtime moved to MainLayout
  const riskMap = useReturnRiskData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedStoreId } = useStoreFilter();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});
  const [savingRemark, setSavingRemark] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [deliveryCompanyFilter, setDeliveryCompanyFilter] = useState<string[]>([]);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  
  
  const { data: trackingOrdersRaw, isLoading } = useTrackingOrders(selectedStoreId);
  const { data: autoConfirmationLogs } = useAutoConfirmationLogs();
  const updateStatus = useUpdateOrderStatus();

  const autoConfirmationLogMap = useMemo(() => {
    return new Map(
      (autoConfirmationLogs ?? [])
        .filter((log: any) => log.order_id)
        .map((log: any) => [log.order_id, log]),
    );
  }, [autoConfirmationLogs]);

  const phoneNumbers = useMemo(() => {
    if (!trackingOrdersRaw) return [];
    return [...new Set(trackingOrdersRaw.map(o => o.customer_phone).filter(Boolean))] as string[];
  }, [trackingOrdersRaw]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);

  // Fetch delivery situations only for tracking order IDs
  const trackingOrderIds = useMemo(() => trackingOrdersRaw?.map(o => o.id) ?? [], [trackingOrdersRaw]);
  const { data: deliveryMap } = useTrackingDeliveries(trackingOrderIds);

  const handleAddRemark = async (orderId: string) => {
    const remark = remarkInputs[orderId]?.trim();
    if (!remark) return;
    
    setSavingRemark(orderId);
    try {
      // Get current notes and append new remark with timestamp
      const order = trackingOrdersRaw?.find(o => o.id === orderId);
      const currentNotes = order?.notes || '';
      const timestamp = new Date().toLocaleString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const newNotes = currentNotes 
        ? `${currentNotes}\n[${timestamp}] ${remark}`
        : `[${timestamp}] ${remark}`;
      
      const { error } = await supabase
        .from('orders')
        .update({ notes: newNotes })
        .eq('id', orderId);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['orders-tracking'] });
      setRemarkInputs(prev => ({ ...prev, [orderId]: '' }));
      toast({
        title: 'Remarque ajoutée',
        description: 'La remarque a été enregistrée.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter la remarque.',
        variant: 'destructive',
      });
    } finally {
      setSavingRemark(null);
    }
  };

  // Filter only tracking-related orders - shipped orders come from Expedition
  const trackingStatuses = ['at_station', 'en_livraison', 'au_bureau', 'alerte', 'delivered', 'Échec_de_livraison'];
  
  // Custom tracking status options with specific labels and colors
  const trackingStatusOptions = [
    { value: 'at_station', label: 'En station', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20', buttonClassName: 'bg-violet-500 text-white border-transparent' },
    { value: 'au_bureau', label: 'Au bureau', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', buttonClassName: 'bg-blue-500 text-white border-transparent' },
    { value: 'en_livraison', label: 'En livraison', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', buttonClassName: 'bg-amber-500 text-white border-transparent' },
    { value: 'alerte', label: 'Alerte', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20', buttonClassName: 'bg-orange-500 text-white border-transparent' },
    { value: 'delivered', label: 'Livré', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', buttonClassName: 'bg-emerald-500 text-white border-transparent' },
    { value: 'Échec_de_livraison', label: 'Échec de livr', className: 'bg-red-500/10 text-red-600 border-red-500/20', buttonClassName: 'bg-red-500 text-white border-transparent' },
  ];
  
  const getTrackingStatusStyle = (status: string) => {
    return trackingStatusOptions.find(s => s.value === status) || trackingStatusOptions[0];
  };

  const trackingOrders = trackingOrdersRaw ?? [];

  // Calculate counts for each filter category
  const statusCounts = useMemo(() => {
    if (!trackingOrders) return { en_station: 0, en_livraison: 0, au_bureau: 0, delivered: 0, alerte: 0, echec_livraison: 0 };
    
    const alerteByStatus = trackingOrders.filter(o => o.status === 'alerte').length;
    const neRepondsPas = trackingOrders.filter(o => {
      if (o.status === 'alerte') return false; // already counted
      if (o.status === 'delivered') return false;
      if (o.status === 'delivered_paid') return false;
      if (o.status === 'returned') return false;
      if (o.status === 'Échec_de_livraison') return false;
      const delivery = deliveryMap?.get(o.id);
      return delivery?.situation && delivery.situation.startsWith('Ne réponds pas');
    }).length;

    return {
      en_station: trackingOrders.filter(o => o.status === 'at_station').length,
      en_livraison: trackingOrders.filter(o => o.status === 'en_livraison').length,
      au_bureau: trackingOrders.filter(o => o.status === 'au_bureau').length,
      delivered: trackingOrders.filter(o => o.status === 'delivered').length,
      alerte: alerteByStatus + neRepondsPas,
      echec_livraison: trackingOrders.filter(o => o.status === 'Échec_de_livraison').length,
    };
  }, [trackingOrders, deliveryMap]);

  // Filter orders based on active filter and search
  const filteredOrders = useMemo(() => {
    if (!trackingOrders) return [];
    
    let filtered = trackingOrders;
    
    // Apply status filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'alerte') {
        // Alerte includes status='alerte' OR delivery situation starts with 'Ne réponds pas'
        filtered = filtered.filter(o => {
          if (o.status === 'alerte') return true;
          if (o.status === 'delivered') return false;
          if (o.status === 'delivered_paid') return false;
          if (o.status === 'returned') return false;
          if (o.status === 'Échec_de_livraison') return false;
          const delivery = deliveryMap?.get(o.id);
          return delivery?.situation && delivery.situation.startsWith('Ne réponds pas');
        });
      } else {
        const statusMap: Record<string, string[]> = {
          en_station: ['at_station'],
          en_livraison: ['en_livraison'],
          au_bureau: ['au_bureau'],
          delivered: ['delivered'],
          echec_livraison: ['Échec_de_livraison'],
        };
        filtered = filtered.filter(o => statusMap[activeFilter]?.includes(o.status));
      }
    }

    // Apply delivery company filter
    if (deliveryCompanyFilter.length > 0) {
      filtered = filtered.filter(o => o.delivery_company && deliveryCompanyFilter.includes(o.delivery_company));
    }

    // Apply delivery type filter
    if (deliveryTypeFilter !== 'all') {
      filtered = filtered.filter(o => o.delivery_type === deliveryTypeFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.order_number.toLowerCase().includes(query) ||
        o.customer_name.toLowerCase().includes(query) ||
        phoneMatchesQuery(o.customer_phone, query) ||
        getWilayaLabel(o.wilaya).toLowerCase().includes(query) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(query)) ||
        o.order_items.some(item => item.product_name.toLowerCase().includes(query))
      );
    }
    
    // For "Livré" and "Échec" tabs: sort by last situation change (most recent first)
    if (activeFilter === 'delivered' || activeFilter === 'echec_livraison') {
      filtered = [...filtered].sort((a, b) => {
        const aUpdate = deliveryMap?.get(a.id)?.last_update;
        const bUpdate = deliveryMap?.get(b.id)?.last_update;
        const aTime = aUpdate ? new Date(aUpdate).getTime() : new Date(a.updated_at || a.created_at).getTime();
        const bTime = bUpdate ? new Date(bUpdate).getTime() : new Date(b.updated_at || b.created_at).getTime();
        return bTime - aTime;
      });
    }

    return filtered;
  }, [trackingOrders, activeFilter, deliveryCompanyFilter, deliveryTypeFilter, searchQuery, deliveryMap]);

  const filterTabs = [
    { key: 'all' as FilterStatus, label: 'Tous', icon: List, count: trackingOrders?.length || 0, color: 'bg-slate-500' },
    { key: 'en_station' as FilterStatus, label: 'En station', icon: Truck, count: statusCounts.en_station, color: 'bg-violet-500' },
    { key: 'au_bureau' as FilterStatus, label: 'Au bureau', icon: Building2, count: statusCounts.au_bureau, color: 'bg-blue-500' },
    { key: 'en_livraison' as FilterStatus, label: 'En livraison', icon: Package, count: statusCounts.en_livraison, color: 'bg-amber-500' },
    { key: 'alerte' as FilterStatus, label: 'Alerte', icon: AlertTriangle, count: statusCounts.alerte, color: 'bg-orange-500' },
    { key: 'delivered' as FilterStatus, label: 'Livré', icon: CheckCircle, count: statusCounts.delivered, color: 'bg-teal-500' },
    { key: 'echec_livraison' as FilterStatus, label: 'Échec', icon: XCircle, count: statusCounts.echec_livraison, color: 'bg-red-500' },
  ];
  
  const agentStats = {
    total: trackingOrders?.length || 0,
    en_station: statusCounts.en_station,
    expedier: statusCounts.au_bureau,
    delivered: statusCounts.delivered,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const handleStatusChange = async (order: OrderWithItems, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        status: newStatus as any,
      });
      toast({
        title: 'Statut mis à jour',
        description: `Commande ${order.order_number} → ${allOrderStatuses.find(s => s.value === newStatus)?.label || newStatus}`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: getOrderErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const isAllSelected = filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length;
  const isSomeSelected = selectedOrders.length > 0;

  const handleBulkStatusChange = async (newStatus: string) => {
    if (filteredOrders.length === 0) return;
    try {
      for (const order of filteredOrders) {
        await updateStatus.mutateAsync({
          id: order.id,
          status: newStatus as any,
        });
      }
      toast({
        title: 'Statuts mis à jour',
        description: `${filteredOrders.length} commande(s) → ${allOrderStatuses.find(s => s.value === newStatus)?.label || newStatus}`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: getOrderErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleExportExcel = useCallback(() => {
    if (filteredOrders.length === 0) {
      toast({ title: 'Info', description: 'Aucune commande à exporter' });
      return;
    }

    const data = filteredOrders.map(o => ({
      'N° Commande': o.order_number,
      'Client': o.customer_name,
      'Téléphone': o.customer_phone,
      'Wilaya': getWilayaLabel(o.wilaya),
      'Commune': o.commune || '',
      'Adresse': o.customer_address || '',
      'Produits': o.order_items.map(i => `${i.product_name} x${i.quantity}`).join(', '),
      'Total': o.total_price,
      'Statut': allOrderStatuses.find(s => s.value === o.status)?.label || o.status,
      'Tracking': o.tracking_number || '',
      'Société': o.delivery_company || '',
      'Date': format(new Date(o.created_at), 'dd/MM/yyyy HH:mm'),
    }));

    writeExcelFile([{ name: 'Tracking', data }], `Tracking-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Succès', description: `${filteredOrders.length} commande(s) exportée(s)` });
  }, [filteredOrders, toast]);

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
                placeholder="Rechercher par N°, nom, téléphone, tracking, produit..."
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

            {/* Action Dropdown */}


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


      {/* Orders Table - Spreadsheet Style */}
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
              <div className="min-w-[1400px]">
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
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[160px]">Situation</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Remarque</th>
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
                          <div className="p-2 space-y-1 text-sm inline-block text-left">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium">{order.customer_name}</span>
                            </div>
                            <WhatsAppPhoneIndicator phone={order.customer_phone} whatsappStatus={whatsappStatus} />
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
                        <TableCell className="text-center max-w-[200px]">
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
                                className={`text-xs px-2 py-1 w-[100px] justify-center select-none ${
                                  order.delivery_type === 'stop_desk' 
                                    ? 'bg-purple-100 text-purple-700 border-purple-300 cursor-pointer' 
                                    : 'bg-blue-100 text-blue-700 border-blue-300 cursor-default'
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
                            <Badge
                              variant="outline"
                              className={`w-full justify-center rounded-md px-2 py-0 text-xs h-8 font-medium cursor-default select-none ${getTrackingStatusStyle(order.status).buttonClassName}`}
                            >
                              <span className="truncate">
                                {getTrackingStatusStyle(order.status).label || allOrderStatuses.find(s => s.value === order.status)?.label}
                              </span>
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const delivery = deliveryMap?.get(order.id);
                            const isLocalLivreur = (order.delivery_company || '').startsWith('local:');
                            
                            // Local livreur: show vote as badge
                            if (isLocalLivreur && delivery?.situation) {
                              const t = delivery.situation.toLowerCase();
                              let bg = 'bg-accent', tc = 'text-accent-foreground', bc = 'border-border';
                              let SIcon = Truck;
                              if (t.includes('livr')) { bg = 'bg-success/10'; tc = 'text-success'; bc = 'border-success/25'; SIcon = CheckCircle2; }
                              else if (t.includes('report') || t.includes('réport')) { bg = 'bg-warning/10'; tc = 'text-warning'; bc = 'border-warning/25'; SIcon = AlertTriangle; }
                              else if (t.includes('répond') || t.includes('repond')) { bg = 'bg-destructive/10'; tc = 'text-destructive'; bc = 'border-destructive/25'; SIcon = AlertTriangle; }
                              else if (t.includes('annul') || t.includes('retour') || t.includes('return')) { bg = 'bg-destructive/10'; tc = 'text-destructive'; bc = 'border-destructive/25'; SIcon = XCircle; }
                              else if (t.includes('échec') || t.includes('echou')) { bg = 'bg-destructive/10'; tc = 'text-destructive'; bc = 'border-destructive/25'; SIcon = XCircle; }
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${bg} border ${bc} max-w-[155px] cursor-default`} title={delivery.situation}>
                                  <SIcon className={`h-3.5 w-3.5 ${tc} shrink-0`} />
                                  <span className={`text-[11px] font-semibold ${tc} truncate`}>{delivery.situation}</span>
                                </span>
                              );
                            }
                            
                            if (!delivery?.situation && !delivery?.status) {
                              if (order.tracking_number && order.delivery_company === 'ZR Express') {
                                return (
                                  <TrackingHistoryPopover
                                    trackingNumber={order.tracking_number}
                                    currentSituation={null}
                                    lastUpdate={delivery?.last_update || null}
                                    deliveryStatus={null}
                                  />
                                );
                              }
                              return <span className="text-muted-foreground text-xs">—</span>;
                            }
                            // For delivered/encaissé orders, show status over stale situation
                            // Must match exact terminal statuses, not partial (e.g. "Sortie en livraison" contains "livr" but is NOT terminal)
                            const statusLower = delivery?.status?.toLowerCase() || '';
                            const isTerminal = statusLower === 'livré' || statusLower === 'encaissé' || statusLower === 'encaissee' || statusLower === 'livre' || statusLower === 'encaisse' || statusLower === 'recouvert';
                            const displayText = isTerminal ? (delivery?.status || delivery?.situation) : (delivery?.situation || delivery?.status) || null;
                            return (
                              <TrackingHistoryPopover
                                trackingNumber={order.tracking_number || ''}
                                currentSituation={displayText}
                                lastUpdate={delivery?.last_update || null}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          <SuiviPopover order={order} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <StatusHistoryPopover order={order} />
                            
                            <TrackingChatButton
                              order={order}
                              whatsappStatus={whatsappStatus}
                              confirmationLogs={autoConfirmationLogs}
                              log={autoConfirmationLogMap.get(order.id)}
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
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Aucune commande en suivi</p>
              <p className="text-muted-foreground">Les commandes expédiées apparaîtront ici.</p>
            </div>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

