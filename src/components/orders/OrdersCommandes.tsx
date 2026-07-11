import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { useActiveStores } from '@/hooks/useStores';
import { ReturnRiskBadge } from '@/components/orders/ReturnRiskBadge';
import { useReturnRiskData } from '@/hooks/useReturnRisk';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Search, Filter, Download, Eye, Phone, MessageSquare, ChevronDown, Truck, User, MapPin, Building2, Home, Package, MessageCircle, Pencil, UserCheck, History, Bot, Send, Trash2, List, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Store } from 'lucide-react';
import { StatusHistoryPopover } from '@/components/orders/StatusHistoryPopover';
import { DeliveryCompanyBadge } from '@/components/orders/DeliveryCompanyBadge';
import { AutoAssignDialog } from '@/components/orders/AutoAssignDialog';
import { useAssignmentRules, useAssignmentSettings } from '@/hooks/useAssignmentRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useUpdateOrderStatus, OrderWithItems } from '@/hooks/useOrders';
import { useOrdersPaginated, PAGE_SIZE, type OrdersFilters } from '@/hooks/useOrdersPaginated';
import { useUsersWithRoles } from '@/hooks/useUserRoles';
import { OrderStatusBadge, allOrderStatuses, getStatusButtonClassName } from '@/components/orders/OrderStatusBadge';
import { AddOrderDialog } from '@/components/orders/AddOrderDialog';
import { EditOrderDialog } from '@/components/orders/EditOrderDialog';
import { ShipOrderDialog } from '@/components/orders/ShipOrderDialog';
import { toast } from 'sonner';
import { getWilayaLabel } from '@/data/algeriaLocations';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { ChatPanel } from '@/components/orders/ChatPanel';
import { StopDeskInfoPopover } from '@/components/orders/StopDeskInfoPopover';
import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';
import { WhatsAppChatButton } from '@/components/orders/WhatsAppChatButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function OrdersCommandes() {
  const queryClient = useQueryClient();
  const riskMap = useReturnRiskData();
  const { selectedStoreId } = useStoreFilter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [deliveryCompanyFilter, setDeliveryCompanyFilter] = useState<string[]>([]);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  const storeFilter = selectedStoreId || 'all';
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [shipOrderData, setShipOrderData] = useState<{ id: string; number: string; customer: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; orderId?: string; orderNumber?: string } | null>(null);
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});
  const [savingRemark, setSavingRemark] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0); // reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter, agentFilter, deliveryCompanyFilter, deliveryTypeFilter, storeFilter]);

  const filters: OrdersFilters = useMemo(() => ({
    search: debouncedSearch,
    status: statusFilter,
    agent: agentFilter,
    deliveryCompanies: deliveryCompanyFilter,
    deliveryType: deliveryTypeFilter,
    storeId: storeFilter,
  }), [debouncedSearch, statusFilter, agentFilter, deliveryCompanyFilter, deliveryTypeFilter, storeFilter]);

  // Server-side paginated query for the table
  const { data: paginatedData, isLoading } = useOrdersPaginated(currentPage, filters);
  const displayOrders = paginatedData?.orders || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 1;

  // Lightweight query for auto-assign (only unassigned + agent counts, no full payload)
  const { data: autoAssignData } = useQuery({
    queryKey: ['orders-auto-assign-counts'],
    queryFn: async () => {
      const [{ data: unassigned }, { data: agentAssigned }, { count: totalCount }] = await Promise.all([
        supabase.from('orders').select('id, source, assigned_agent, order_items(product_name)').is('assigned_agent', null),
        supabase.from('orders').select('assigned_agent').not('assigned_agent', 'is', null)
          .not('status', 'in', '(delivered,delivered_paid,cancelled,returned)'),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
      ]);
      const agentCounts: Record<string, number> = {};
      (agentAssigned || []).forEach(o => {
        if (o.assigned_agent) agentCounts[o.assigned_agent] = (agentCounts[o.assigned_agent] || 0) + 1;
      });
      return { unassigned: unassigned || [], agentCounts, totalCount: totalCount || 0 };
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: activeStores } = useActiveStores();
  
  const updateStatus = useUpdateOrderStatus();
  const { data: usersWithRoles } = useUsersWithRoles();
  const { data: assignmentRules = [] } = useAssignmentRules();
  const { data: assignmentSettings } = useAssignmentSettings();
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const { data: confirmationLogs } = useAutoConfirmationLogs();

  // Get unique phone numbers from current page for WhatsApp check
  const phoneNumbers = useMemo(() => {
    return [...new Set(displayOrders.map(o => o.customer_phone).filter(Boolean))];
  }, [displayOrders]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);

  const confirmateurs = useMemo(() => {
    return (usersWithRoles || []).filter(u => u.role === 'confirmateur');
  }, [usersWithRoles]);

  const handleAssignAgent = async (orderId: string, agentName: string | null) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_agent: agentName })
        .eq('id', orderId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['orders-paginated'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(agentName ? `Assigné à ${agentName}` : 'Agent retiré');
    } catch {
      toast.error("Erreur lors de l'assignation");
    }
  };

  const handleBulkAssignAgent = async (agentName: string | null) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_agent: agentName })
        .in('id', selectedOrders);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['orders-paginated'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(agentName ? `${selectedOrders.length} commande(s) assignée(s) à ${agentName}` : 'Agents retirés');
      setSelectedOrders([]);
    } catch {
      toast.error("Erreur lors de l'assignation groupée");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const handleAddRemark = async (orderId: string) => {
    const remark = remarkInputs[orderId]?.trim();
    if (!remark) return;
    
    setSavingRemark(orderId);
    try {
      const order = displayOrders.find(o => o.id === orderId);
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
      
      await queryClient.invalidateQueries({ queryKey: ['orders-paginated'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      setRemarkInputs(prev => ({ ...prev, [orderId]: '' }));
      toast.success('Remarque ajoutée');
    } catch (error) {
      toast.error('Impossible d\'ajouter la remarque');
    } finally {
      setSavingRemark(null);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    if (selectedOrders.length === displayOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(displayOrders.map(o => o.id));
    }
  };

  const canShipOrder = (status: string) => {
    return ['confirmed', 'ready', 'preparing'].includes(status);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: orderId,
        status: newStatus as any,
      });
      toast.success(`Statut changé en "${allOrderStatuses.find(s => s.value === newStatus)?.label}"`);
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const handleDeleteOrder = (orderId: string, orderNumber: string) => {
    setDeleteConfirm({ type: 'single', orderId, orderNumber });
  };

  const handleBulkDelete = () => {
    setDeleteConfirm({ type: 'bulk' });
  };

  const restoreStockForOrders = async (orderIds: string[]) => {
    const { data: ordersToDelete } = await supabase
      .from('orders')
      .select('id, status, order_number')
      .in('id', orderIds);
    
    if (!ordersToDelete) return;

    const reservedStatuses = ['preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'Échec_de_livraison', 'exchange', 'alerte'];

    for (const ord of ordersToDelete) {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', ord.id)
        .not('product_id', 'is', null);

      if (!items || items.length === 0) continue;

      for (const item of items) {
        if (!item.product_id) continue;

        const { data: product } = await supabase
          .from('products')
          .select('id, current_stock, reserved_stock')
          .eq('id', item.product_id)
          .single();

        if (!product) continue;

        if (reservedStatuses.includes(ord.status)) {
          await supabase
            .from('products')
            .update({
              current_stock: product.current_stock + item.quantity,
              reserved_stock: Math.max(0, product.reserved_stock - item.quantity),
            })
            .eq('id', item.product_id);
        } else if (['delivered', 'delivered_paid'].includes(ord.status)) {
          await supabase
            .from('products')
            .update({
              current_stock: product.current_stock + item.quantity,
            })
            .eq('id', item.product_id);
        }
      }

      await supabase
        .from('stock_movements')
        .delete()
        .eq('reference', ord.order_number);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'single' && deleteConfirm.orderId) {
        await restoreStockForOrders([deleteConfirm.orderId]);
        await supabase.from('auto_confirmation_logs').delete().eq('order_id', deleteConfirm.orderId);
        await supabase.from('deliveries').delete().eq('order_id', deleteConfirm.orderId);
        await supabase.from('alerts').delete().eq('order_id', deleteConfirm.orderId);
        await supabase.from('order_history').delete().eq('order_id', deleteConfirm.orderId);
        await supabase.from('stock_movements').delete().eq('reference', deleteConfirm.orderNumber || '');
        await supabase.from('order_items').delete().eq('order_id', deleteConfirm.orderId);
        const { error } = await supabase.from('orders').delete().eq('id', deleteConfirm.orderId);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['orders-paginated'] });
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
        toast.success(`Commande ${deleteConfirm.orderNumber} supprimée`);
      } else {
        await restoreStockForOrders(selectedOrders);
        await supabase.from('auto_confirmation_logs').delete().in('order_id', selectedOrders);
        await supabase.from('deliveries').delete().in('order_id', selectedOrders);
        await supabase.from('alerts').delete().in('order_id', selectedOrders);
        await supabase.from('order_history').delete().in('order_id', selectedOrders);
        await supabase.from('order_items').delete().in('order_id', selectedOrders);
        const { error } = await supabase.from('orders').delete().in('id', selectedOrders);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['orders-paginated'] });
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
        toast.success(`${selectedOrders.length} commande(s) supprimée(s)`);
        setSelectedOrders([]);
      }
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAutoAssign = async () => {
    if (!autoAssignData || confirmateurs.length === 0) return;
    setIsAutoAssigning(true);
    try {
      const unassigned = autoAssignData.unassigned;
      if (unassigned.length === 0) {
        toast.info('Toutes les commandes sont déjà assignées');
        return;
      }

      const mode = (assignmentSettings?.mode as string) || 'round_robin';
      const assignments: { id: string; agent: string }[] = [];

      const agentCounts: Record<string, number> = { ...autoAssignData.agentCounts };
      confirmateurs.forEach(a => {
        const name = a.full_name || a.email || 'Agent';
        if (!(name in agentCounts)) agentCounts[name] = 0;
      });

      let rrIndex = 0;

      for (const order of unassigned) {
        let assignedAgent: string | null = null;

        if (mode === 'rules' || mode === 'combined') {
          const sourceRule = assignmentRules.find(r => r.rule_type === 'source' && r.match_value === order.source && r.is_active);
          if (sourceRule) assignedAgent = sourceRule.agent_name;

          if (!assignedAgent) {
            const productNames = order.order_items.map(i => i.product_name);
            const productRule = assignmentRules.find(r => r.rule_type === 'product' && productNames.includes(r.match_value) && r.is_active);
            if (productRule) assignedAgent = productRule.agent_name;
          }

          if (mode === 'rules' && !assignedAgent) continue;
        }

        if (!assignedAgent) {
          if (mode === 'workload' || mode === 'combined') {
            const sortedAgents = confirmateurs
              .map(a => ({ name: a.full_name || a.email || 'Agent', count: agentCounts[a.full_name || a.email || 'Agent'] || 0 }))
              .sort((a, b) => a.count - b.count);
            assignedAgent = sortedAgents[0]?.name || null;
          } else {
            const agentNames = confirmateurs.map(a => a.full_name || a.email || 'Agent');
            assignedAgent = agentNames[rrIndex % agentNames.length];
            rrIndex++;
          }
        }

        if (assignedAgent) {
          assignments.push({ id: order.id, agent: assignedAgent });
          agentCounts[assignedAgent] = (agentCounts[assignedAgent] || 0) + 1;
        }
      }

      for (const a of assignments) {
        await supabase.from('orders').update({ assigned_agent: a.agent }).eq('id', a.id);
      }

      await queryClient.invalidateQueries({ queryKey: ['orders-paginated'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`${assignments.length} commande(s) assignée(s) automatiquement`);
    } catch {
      toast.error("Erreur lors de l'assignation automatique");
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Pagination info
  const startItem = totalCount === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const endItem = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] overflow-hidden gap-4">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="page-header">
          <h1 className="page-title">Commandes</h1>
          <p className="page-description">
            Gérez toutes vos commandes COD ({autoAssignData?.totalCount || totalCount} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoAssignDialog 
            confirmateurs={confirmateurs} 
            onAutoAssign={handleAutoAssign} 
            isAssigning={isAutoAssigning} 
          />
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Commande
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher par N°, nom, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              autoComplete="new-password"
              name={"search_" + Date.now()}
              data-lpignore="true"
              data-form-type="other"
            />
          </div>
          
          {/* Combined Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 min-w-[120px] justify-between gap-2">
                <span className="flex items-center gap-2">
                  <List className="h-4 w-4 text-muted-foreground" />
                  Filtre
                  {(() => {
                    const activeCount = (deliveryCompanyFilter.length > 0 ? 1 : 0) + (deliveryTypeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (agentFilter !== 'all' ? 1 : 0);
                    return activeCount > 0 ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">{activeCount}</Badge>
                    ) : null;
                  })()}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[520px] p-0 max-h-[80vh]" align="start">
              <ScrollArea className="max-h-[70vh]">
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Société</div>
                    <div className="space-y-1">
                      {(['RJ360', 'ZR Express', 'Maystro'] as const).map((company) => {
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
                    <div className="mt-4">
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
                    {/* Store filter removed - now controlled globally from sidebar */}
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Agent</div>
                    <div className="space-y-1">
                      <button
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border text-left transition-all duration-150 ${agentFilter === 'all' ? 'bg-muted border-border' : 'border-transparent hover:bg-muted/60'}`}
                        onClick={() => setAgentFilter('all')}
                      >
                        <UserCheck className={`h-4 w-4 ${agentFilter === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${agentFilter === 'all' ? 'text-foreground' : 'text-muted-foreground'}`}>Tous les agents</span>
                      </button>
                      <button
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border text-left transition-all duration-150 ${agentFilter === 'unassigned' ? 'bg-muted border-border' : 'border-transparent hover:bg-muted/60'}`}
                        onClick={() => setAgentFilter('unassigned')}
                      >
                        <User className={`h-4 w-4 ${agentFilter === 'unassigned' ? 'text-foreground' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${agentFilter === 'unassigned' ? 'text-foreground' : 'text-muted-foreground'}`}>Non assigné</span>
                      </button>
                      {(usersWithRoles || []).filter(u => u.role === 'confirmateur').map((agent) => {
                        const name = agent.full_name || agent.email || 'Agent';
                        const initials = name.slice(0, 1).toUpperCase();
                        const colors = ['bg-purple-600', 'bg-purple-500', 'bg-violet-600', 'bg-indigo-500', 'bg-purple-700', 'bg-fuchsia-600'];
                        const color = colors[name.charCodeAt(0) % colors.length];
                        const isActive = agentFilter === name;
                        return (
                          <button
                            key={agent.id}
                            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border text-left transition-all duration-150 ${isActive ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' : 'border-transparent hover:bg-muted/60'}`}
                            onClick={() => setAgentFilter(name)}
                          >
                            <span className={`h-5 w-5 rounded-full ${color} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                              {initials}
                            </span>
                            <span className={`text-sm font-medium truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Statut</div>
                      <div className="space-y-1">
                        <button
                          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border text-left transition-all duration-150 ${statusFilter === 'all' ? 'bg-muted border-border' : 'border-transparent hover:bg-muted/60'}`}
                          onClick={() => setStatusFilter('all')}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full bg-primary shrink-0`} />
                          <span className={`text-sm font-medium ${statusFilter === 'all' ? 'text-foreground' : 'text-muted-foreground'}`}>Tous les statuts</span>
                        </button>
                        <ScrollArea className="h-[160px]">
                          <div className="space-y-1">
                            {allOrderStatuses.map((status) => {
                              const isActive = statusFilter === status.value;
                              return (
                                <button
                                  key={status.value}
                                  className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border text-left transition-all duration-150 ${isActive ? 'bg-muted border-border' : 'border-transparent hover:bg-muted/60'}`}
                                  onClick={() => setStatusFilter(status.value)}
                                >
                                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${status.dotColor}`} />
                                  <span className={`text-sm font-medium truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{status.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              {(deliveryCompanyFilter.length > 0 || deliveryTypeFilter !== 'all' || statusFilter !== 'all' || agentFilter !== 'all') && (
                <div className="border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => { setDeliveryCompanyFilter([]); setDeliveryTypeFilter('all'); setStatusFilter('all'); setAgentFilter('all'); }}
                  >
                    Effacer tous les filtres
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2" disabled={selectedOrders.length === 0}>
                    Actions {selectedOrders.length > 0 && `(${selectedOrders.length})`}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50 w-[200px]">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Assigner à un agent
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-popover border border-border shadow-lg z-50 w-[200px] p-1">
                      <DropdownMenuItem onClick={() => handleBulkAssignAgent(null)} className="flex items-center gap-2 rounded-md">
                        <div className="h-6 w-6 rounded-full bg-gray-400 flex items-center justify-center">
                          <User className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-muted-foreground text-sm font-semibold">Non assigné</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {confirmateurs.map((agent, idx) => {
                        const name = agent.full_name || agent.email || 'Agent';
                        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        const colors = ['bg-purple-600', 'bg-purple-500', 'bg-violet-600', 'bg-indigo-500', 'bg-purple-700', 'bg-fuchsia-600'];
                        const color = colors[idx % colors.length];
                        return (
                          <DropdownMenuItem
                            key={agent.id}
                            onClick={() => handleBulkAssignAgent(name)}
                            className="flex items-center gap-2 rounded-md"
                          >
                            <div className={`h-6 w-6 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                              {initials}
                            </div>
                            <span className="text-sm font-semibold truncate">{name}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem>
                    <Truck className="h-4 w-4 mr-2" />
                    Envoyer en livraison
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter Excel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
        </div>
      </Card>

      {/* Orders Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="p-0 flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : displayOrders.length > 0 ? (
            <div className="h-full overflow-auto">
              <div className="min-w-[1350px]">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b sticky top-0 z-20 bg-border">
                    <tr className="border-b border-border transition-colors [&_th]:text-foreground [&_th]:font-semibold">
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[40px]">
                        <Checkbox
                          checked={selectedOrders.length === displayOrders.length && displayOrders.length > 0}
                          onCheckedChange={toggleAllOrders}
                        />
                      </th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">N° Commande</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[180px]">Informations destinataire</th>
                      <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[180px]">Adresse destinataire</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Produit</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Total</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Type Livraison</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[140px]">Statut</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Remarque</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[140px]">Agent</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <TableBody>
                    {displayOrders.map((order, index) => (
                      <TableRow 
                        key={order.id} 
                        className={`
                          hover:bg-muted/30 transition-colors [&_td]:py-[3.5px]
                          ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                        `}
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>

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
                              <span className="text-muted-foreground truncate max-w-[140px]" title={order.customer_address}>
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
                              <ScrollArea className="h-[300px]">
                                {allOrderStatuses.map((statusOption) => (
                                  <DropdownMenuItem
                                    key={statusOption.value}
                                    onClick={() => handleStatusChange(order.id, statusOption.value)}
                                    className={order.status === statusOption.value ? 'bg-muted' : ''}
                                  >
                                    <OrderStatusBadge status={statusOption.value as any} />
                                  </DropdownMenuItem>
                                ))}
                              </ScrollArea>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>

                        <TableCell className="text-center">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant={order.notes ? "secondary" : "outline"} 
                                size="sm" 
                                className="gap-1.5 text-xs w-fit"
                              >
                                {order.notes ? <MessageCircle className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                {order.notes ? `Voir (${order.notes.split('\n').filter(l => l.trim()).length})` : 'Ajouter'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" side="right" align="start">
                              <div className="p-3 border-b flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <h4 className="font-semibold text-sm">Remarques - {formatOrderNumber(order.order_number)}</h4>
                              </div>
                              <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                                {order.notes && [...order.notes.split('\n').filter(line => line.trim())].reverse().map((line, idx) => {
                                  const match = line.match(/^\[(.+?)\]\s*(.+)$/);
                                  const timestamp = match ? match[1] : null;
                                  const remark = match ? match[2] : line;
                                  
                                  return (
                                    <div key={idx} className="bg-muted/50 rounded-lg p-2 border border-border/50">
                                      {timestamp && (
                                        <div className="text-xs text-muted-foreground mb-1">{timestamp}</div>
                                      )}
                                      <p className="text-sm">{remark}</p>
                                    </div>
                                  );
                                })}
                                {!order.notes && (
                                  <p className="text-sm text-muted-foreground text-center py-2">Aucune remarque</p>
                                )}
                              </div>
                              <div className="p-3 border-t space-y-2">
                                <Textarea 
                                  placeholder="Ajouter une remarque..."
                                  value={remarkInputs[order.id] || ''}
                                  onChange={(e) => setRemarkInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                  className="text-sm resize-none"
                                  rows={2}
                                />
                                <Button 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => handleAddRemark(order.id)}
                                  disabled={savingRemark === order.id || !remarkInputs[order.id]?.trim()}
                                >
                                  {savingRemark === order.id ? 'Enregistrement...' : 'Ajouter'}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>

                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs h-8 gap-1.5 w-full justify-between font-semibold"
                              >
                                <span className="truncate flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 shrink-0" />
                                  {order.assigned_agent || 'Non assigné'}
                                </span>
                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="bg-popover border border-border shadow-lg z-50 w-[220px] p-1">
                              <DropdownMenuItem onClick={() => handleAssignAgent(order.id, null)} className="flex items-center gap-2 rounded-md">
                                <div className="h-6 w-6 rounded-full bg-gray-400 flex items-center justify-center">
                                  <User className="h-3 w-3 text-white" />
                                </div>
                                <span className="text-muted-foreground text-sm font-semibold">Non assigné</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {confirmateurs.map((agent, idx) => {
                                const name = agent.full_name || agent.email || 'Agent';
                                const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                const colors = [
                                  'bg-purple-600', 'bg-purple-500', 'bg-violet-600', 'bg-indigo-500', 'bg-purple-700', 'bg-fuchsia-600'
                                ];
                                const color = colors[idx % colors.length];
                                const isSelected = order.assigned_agent === name;
                                return (
                                  <DropdownMenuItem
                                    key={agent.id}
                                    onClick={() => handleAssignAgent(order.id, name)}
                                    className={`flex items-center gap-2 rounded-md ${isSelected ? 'bg-primary/10' : ''}`}
                                  >
                                    <div className={`h-6 w-6 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                      {initials}
                                    </div>
                                    <span className="text-sm font-semibold truncate">{name}</span>
                                    {isSelected && <UserCheck className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusHistoryPopover order={order} />
                            <EditOrderDialog order={order as any} />
                            <WhatsAppChatButton
                              order={order}
                              whatsappStatus={whatsappStatus}
                              confirmationLogs={confirmationLogs}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Supprimer"
                              onClick={() => handleDeleteOrder(order.id, order.order_number)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
              <p className="text-muted-foreground">Aucune commande trouvée</p>
              <Button variant="link" onClick={() => setShowAddDialog(true)}>
                Créer votre première commande
              </Button>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-background flex-shrink-0">
            <div className="text-sm text-muted-foreground">
              {startItem}–{endItem} sur {totalCount} commande{totalCount > 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                aria-label="Première page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 mx-2">
                <span className="text-sm font-medium">
                  Page {currentPage + 1} / {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                aria-label="Dernière page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AddOrderDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      
      {shipOrderData && (
        <ShipOrderDialog
          open={!!shipOrderData}
          onOpenChange={(open) => !open && setShipOrderData(null)}
          orderId={shipOrderData.id}
          orderNumber={shipOrderData.number}
          customerName={shipOrderData.customer}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'single'
                ? `Êtes-vous sûr de vouloir supprimer la commande ${deleteConfirm.orderNumber} ? Cette action est irréversible.`
                : `Êtes-vous sûr de vouloir supprimer ${selectedOrders.length} commande(s) ? Cette action est irréversible.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
