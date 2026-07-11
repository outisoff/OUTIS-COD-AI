import { useState, useMemo, useCallback } from 'react';
import { useUpdateOrderStatus, OrderWithItems } from '@/hooks/useOrders';
import { usePayeRetourOrders } from '@/hooks/usePayeRetourOrders';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { useReturnRiskData } from '@/hooks/useReturnRisk';
import { ReturnRiskBadge } from '@/components/orders/ReturnRiskBadge';
import { useDeliveryFees } from '@/hooks/useDeliveryFees';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OrderStatusBadge, allOrderStatuses, getStatusButtonClassName } from '@/components/orders/OrderStatusBadge';
import { DeliveryCompanyBadge } from '@/components/orders/DeliveryCompanyBadge';
import { StopDeskInfoPopover } from '@/components/orders/StopDeskInfoPopover';
import { SuiviPopover } from '@/components/orders/SuiviPopover';
import { phoneMatchesQuery } from '@/lib/phoneSearch';
import { TrackingHistoryPopover } from '@/components/orders/TrackingHistoryPopover';
import { StatusHistoryPopover } from '@/components/orders/StatusHistoryPopover';
import { ChatPanel } from '@/components/orders/ChatPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';
import { formatOrderNumber } from '@/lib/formatOrderNumber';

import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Search, Package, DollarSign, TruckIcon, XCircle, List, ChevronDown, Truck, MapPin, Home, Building2, User, CheckCircle2, AlertTriangle, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getWilayaLabel } from '@/data/algeriaLocations';

const normalizeWilaya = (w: string): string => {
  return w
    .replace(/^\d+\s*-\s*/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ');
};

type FilterStatus = 'all' | 'delivered' | 'delivered_paid' | 'echec' | 'returned';

function PayeRetourChatButton({ order, whatsappStatus }: { order: OrderWithItems; whatsappStatus?: Record<string, boolean | null> | null }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: logs } = useAutoConfirmationLogs();

  const log = logs?.find((l: any) => l.order_id === order.id);
  const isChecked = whatsappStatus && order.customer_phone in whatsappStatus;
  const noWhatsApp = isChecked && whatsappStatus[order.customer_phone] === false;

  if (noWhatsApp) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive cursor-not-allowed opacity-70" disabled>
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
        <ChatPanel order={order} confirmationLogs={logs} />
      </SheetContent>
    </Sheet>
  );
}

const PayeRetour = () => {
  const { selectedStoreId } = useStoreFilter();
  const riskMap = useReturnRiskData();
  const updateStatus = useUpdateOrderStatus();
  const { data: orders, isLoading } = usePayeRetourOrders(selectedStoreId);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [filterCompany, setFilterCompany] = useState<string[]>([]);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  

  const phoneNumbers = useMemo(() => {
    if (!orders) return [];
    return [...new Set(orders.map(o => o.customer_phone).filter(Boolean))];
  }, [orders]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);

  // Fetch all fee data for real cost calculation
  const { data: companyFees } = useQuery({
    queryKey: ['all-delivery-company-fees'],
    queryFn: async () => {
      const { data } = await supabase.from('delivery_company_fees').select('delivery_company, wilaya_name, home_delivery_fee, stop_desk_fee, return_fee');
      return data || [];
    },
  });
  const { data: generalFees } = useDeliveryFees();
  const { data: localLivreurs } = useQuery({
    queryKey: ['local-livreurs-all'],
    queryFn: async () => {
      const { data } = await supabase.from('local_livreurs').select('id, name, tarif, return_tarif') as any;
      return (data || []) as { id: string; name: string; tarif: number; return_tarif: number }[];
    },
  });

  // Fetch delivery situations
  const { data: deliveryMapData } = useQuery({
    queryKey: ['deliveries-situations-paye-retour'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deliveries')
        .select('order_id, delivery_status, delivery_situation, last_update')
        .order('last_update', { ascending: false });
      const map = new Map<string, { status: string | null; situation: string | null; last_update: string | null }>();
      data?.forEach(d => {
        if (d.order_id && !map.has(d.order_id)) {
          map.set(d.order_id, { status: d.delivery_status, situation: d.delivery_situation, last_update: d.last_update });
        }
      });
      return map;
    },
  });
  const deliveryMap = deliveryMapData || new Map<string, { status: string | null; situation: string | null; last_update: string | null }>();

  // Build fee lookup maps
  const { companyFeeMap, companyFeeMapNorm, generalFeeMap, generalFeeMapNorm, localLivreurMap, localLivreurReturnMap } = useMemo(() => {
    const cfMap = new Map<string, { home: number; desk: number; return_fee: number }>();
    (companyFees || []).forEach(f => {
      cfMap.set(`${f.delivery_company}|${f.wilaya_name}`, {
        home: Number(f.home_delivery_fee), desk: Number(f.stop_desk_fee), return_fee: Number(f.return_fee)
      });
    });
    const cfMapNorm = new Map<string, { home: number; desk: number; return_fee: number }>();
    cfMap.forEach((v, k) => {
      const [company, wilaya] = k.split('|');
      cfMapNorm.set(`${company}|${normalizeWilaya(wilaya)}`, v);
    });
    const gfMap = new Map<string, { home: number; desk: number }>();
    (generalFees || []).forEach(f => {
      gfMap.set(f.wilaya_name, { home: Number(f.home_delivery_fee), desk: Number(f.stop_desk_fee) });
    });
    const gfMapNorm = new Map<string, { home: number; desk: number }>();
    gfMap.forEach((v, k) => {
      gfMapNorm.set(normalizeWilaya(k), v);
    });
    const llMap = new Map<string, number>();
    const llReturnMap = new Map<string, number>();
    (localLivreurs || []).forEach(l => {
      llMap.set(l.name.toLowerCase(), Number(l.tarif));
      llReturnMap.set(l.name.toLowerCase(), Number(l.return_tarif || 0));
    });
    return { companyFeeMap: cfMap, companyFeeMapNorm: cfMapNorm, generalFeeMap: gfMap, generalFeeMapNorm: gfMapNorm, localLivreurMap: llMap, localLivreurReturnMap: llReturnMap };
  }, [companyFees, generalFees, localLivreurs]);

  const getRealDeliveryCost = useCallback((o: any): number => {
    if (o.delivery_company && o.delivery_company.startsWith('local:')) {
      const livreurName = o.delivery_company.replace('local:', '').toLowerCase();
      return localLivreurMap.get(livreurName) || 0;
    }
    const isHome = o.delivery_type === 'home';
    const wilayaNorm = normalizeWilaya(o.wilaya);
    if (o.delivery_company) {
      const key = `${o.delivery_company}|${wilayaNorm}`;
      const cf = companyFeeMap.get(`${o.delivery_company}|${o.wilaya}`) || companyFeeMapNorm.get(key);
      if (cf) return isHome ? cf.home : cf.desk;
    }
    const gf = generalFeeMap.get(o.wilaya) || generalFeeMapNorm.get(wilayaNorm);
    if (gf) return isHome ? gf.home : gf.desk;
    return 0;
  }, [companyFeeMap, companyFeeMapNorm, generalFeeMap, generalFeeMapNorm, localLivreurMap]);

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} DA`;

  // Unique companies for filters
  const uniqueCompanies = useMemo(() => {
    if (!orders) return [];
    const relevant = orders.filter(o =>
      ['delivered', 'delivered_paid', 'Échec_de_livraison', 'returned'].includes(o.status)
    );
    return [...new Set(relevant.map(o => o.delivery_company).filter(Boolean))].sort() as string[];
  }, [orders]);

  const { filteredOrders, counts, totalCount } = useMemo(() => {
    if (!orders) return { filteredOrders: [], counts: { delivered: 0, delivered_paid: 0, echec: 0, returned: 0 }, totalCount: 0 };
    const relevant = orders.filter(o =>
      ['delivered', 'delivered_paid', 'Échec_de_livraison', 'returned'].includes(o.status)
    );

    const c = {
      delivered: relevant.filter(o => o.status === 'delivered').length,
      delivered_paid: relevant.filter(o => o.status === 'delivered_paid').length,
      echec: relevant.filter(o => o.status === 'Échec_de_livraison').length,
      returned: relevant.filter(o => o.status === 'returned').length,
    };

    let filtered = relevant;
    if (activeFilter === 'delivered') filtered = filtered.filter(o => o.status === 'delivered');
    if (activeFilter === 'delivered_paid') filtered = filtered.filter(o => o.status === 'delivered_paid');
    if (activeFilter === 'echec') filtered = filtered.filter(o => o.status === 'Échec_de_livraison');
    if (activeFilter === 'returned') filtered = filtered.filter(o => o.status === 'returned');

    if (filterCompany.length > 0) {
      filtered = filtered.filter(o => o.delivery_company && filterCompany.includes(o.delivery_company));
    }
    if (deliveryTypeFilter !== 'all') {
      filtered = filtered.filter(o => o.delivery_type === deliveryTypeFilter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(s) ||
        o.customer_name?.toLowerCase().includes(s) ||
        phoneMatchesQuery(o.customer_phone, s) ||
        o.wilaya?.toLowerCase().includes(s)
      );
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { filteredOrders: filtered, counts: c, totalCount: relevant.length };
  }, [orders, activeFilter, search, filterCompany, deliveryTypeFilter]);

  const handleStatusChange = useCallback(async (order: any, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, status: newStatus as any });
      toast({ title: 'Statut mis à jour', description: `Commande ${order.order_number} → ${allOrderStatuses.find(s => s.value === newStatus)?.label}` });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  }, [updateStatus]);


  const ordersForTotals = filteredOrders.filter(o => ['delivered', 'delivered_paid'].includes(o.status));
  const totalSales = ordersForTotals.reduce((s, o) => s + Number(o.total_price), 0);
  const totalDelivery = ordersForTotals.reduce((s, o) => s + getRealDeliveryCost(o), 0);
  // totalReturnFeesCalc will be calculated after getReturnFee is defined
  let totalRevenus = totalSales - totalDelivery;

  const getReturnFee = useCallback((o: any): number => {
    if (o.delivery_company && o.delivery_company.startsWith('local:')) {
      const livreurName = o.delivery_company.replace('local:', '').toLowerCase();
      return localLivreurReturnMap.get(livreurName) || 0;
    }
    const wilayaNorm = normalizeWilaya(o.wilaya);
    if (o.delivery_company) {
      const key = `${o.delivery_company}|${wilayaNorm}`;
      const cf = companyFeeMap.get(`${o.delivery_company}|${o.wilaya}`) || companyFeeMapNorm.get(key);
      if (cf) return cf.return_fee;
    }
    return 0;
  }, [companyFeeMap, companyFeeMapNorm, localLivreurReturnMap]);

  // Return fees from ALL returned orders for global revenus calculation
  const allReturnedOrders = (orders || []).filter(o => o.status === 'returned');
  const totalReturnFeesGlobal = allReturnedOrders.reduce((s, o) => s + getReturnFee(o), 0);
  // Return fees from filtered returned orders (respects search/company/delivery type filters)
  const filteredReturnedOrders = filteredOrders.filter(o => o.status === 'returned');
  const totalReturnFeesFiltered = filteredReturnedOrders.reduce((s, o) => s + getReturnFee(o), 0);
  // Échec orders return fees (for displaying in Livré tab)
  const allEchecOrders = (orders || []).filter(o => o.status === 'Échec_de_livraison');
  const totalEchecReturnFees = allEchecOrders.reduce((s, o) => s + getReturnFee(o), 0);
  // Display return fees based on active tab
  // Return fees from filtered returned orders for Payé tab
  const totalReturnedReturnFees = allReturnedOrders.reduce((s, o) => s + getReturnFee(o), 0);
  const totalAllReturnFees = totalReturnFeesGlobal + totalEchecReturnFees;
  const totalReturnFees = activeFilter === 'returned' ? totalReturnFeesFiltered 
    : activeFilter === 'delivered' ? totalEchecReturnFees
    : activeFilter === 'echec' ? totalEchecReturnFees
    : activeFilter === 'delivered_paid' ? totalReturnedReturnFees
    : totalAllReturnFees;
  // Update revenus to subtract return fees (only returned, not échec)
  totalRevenus = totalSales - totalDelivery - totalReturnFeesGlobal;

  const filterTabs = useMemo(() => [
    { key: 'all' as FilterStatus, label: 'Tous', icon: List, count: totalCount, color: 'bg-slate-600' },
    { key: 'delivered' as FilterStatus, label: 'Livré', icon: TruckIcon, count: counts.delivered, color: 'bg-green-500' },
    { key: 'echec' as FilterStatus, label: 'Échec', icon: XCircle, count: counts.echec, color: 'bg-orange-500' },
    { key: 'delivered_paid' as FilterStatus, label: 'Payé', icon: DollarSign, count: counts.delivered_paid, color: 'bg-emerald-500' },
    { key: 'returned' as FilterStatus, label: 'Retourné', icon: Package, count: counts.returned, color: 'bg-red-500' },
  ], [totalCount, counts]);

  const hasActiveFilters = filterCompany.length > 0 || deliveryTypeFilter !== 'all';

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in gap-4 overflow-hidden">
      {/* Search and Filter Bar */}
      <Card className="p-4 flex-shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Rechercher par N°, nom, téléphone, wilaya..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                autoComplete="new-password"
              />
            </div>

            {/* Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 min-w-[120px] justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    Filtre
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {(filterCompany.length > 0 ? 1 : 0) + (deliveryTypeFilter !== 'all' ? 1 : 0)}
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
                      {uniqueCompanies.map((company) => {
                        const isChecked = filterCompany.includes(company);
                        return (
                          <label
                            key={company}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer transition-all duration-150 ${isChecked ? 'bg-muted border-border' : 'border-transparent hover:bg-muted/60'}`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilterCompany([...filterCompany, company]);
                                } else {
                                  setFilterCompany(filterCompany.filter(c => c !== company));
                                }
                              }}
                            />
                            <Truck className="h-4 w-4 text-muted-foreground" />
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
                {hasActiveFilters && (
                  <div className="border-t px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => { setFilterCompany([]); setDeliveryTypeFilter('all'); }}
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
            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Revenus</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">{totalRevenus.toLocaleString()} DA</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Livraison</p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">{totalDelivery.toLocaleString()} DA</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Retour</p>
                <p className="text-lg font-black text-red-600 dark:text-red-400 leading-none">
                  {(['all', 'echec', 'returned', 'delivered', 'delivered_paid'] as FilterStatus[]).includes(activeFilter) ? totalReturnFees.toLocaleString() : '0'} DA
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 min-h-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="h-full overflow-auto">
              <div className="min-w-[1300px]">
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className={`w-full justify-between text-xs h-8 ${getStatusButtonClassName(order.status as any)}`}
                                  disabled={updateStatus.isPending}
                                >
                                  <span className="truncate">
                                    {allOrderStatuses.find(s => s.value === order.status)?.label}
                                  </span>
                                  <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="bg-popover border border-border shadow-lg z-50 w-[180px]">
                                {order.status === 'delivered' && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order, 'delivered_paid')}
                                  >
                                    <OrderStatusBadge status={'delivered_paid' as any} />
                                  </DropdownMenuItem>
                                )}
                                {order.status === 'Échec_de_livraison' && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order, 'returned')}
                                  >
                                    <OrderStatusBadge status={'returned' as any} />
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const delivery = deliveryMap.get(order.id);
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
                            const statusLower = delivery?.status?.toLowerCase() || '';
                            const situationLower = delivery?.situation?.toLowerCase() || '';
                            const isTerminal = statusLower === 'livré' || statusLower === 'encaissé' || statusLower === 'encaissee' || statusLower === 'livre' || statusLower === 'encaisse' || statusLower === 'recouvert' || situationLower === 'recouvert' || situationLower.includes('recouvert');
                            const displayText = isTerminal 
                              ? (situationLower.includes('recouvert') ? delivery?.situation : (delivery?.status || delivery?.situation))
                              : (delivery?.situation || delivery?.status) || null;
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
                            <PayeRetourChatButton order={order} whatsappStatus={whatsappStatus} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Aucune commande trouvée
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PayeRetour;
