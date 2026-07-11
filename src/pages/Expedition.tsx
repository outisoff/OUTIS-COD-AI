import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Package, CheckCircle, Truck, Clock, MessageCircle, ChevronDown, Home, Building2, Box, List, Search, PackageCheck, AlertTriangle, Building, User, Phone, MapPin, Download, Loader2, Printer } from 'lucide-react';
import { ReturnRiskBadge } from '@/components/orders/ReturnRiskBadge';
import { useReturnRiskData } from '@/hooks/useReturnRisk';
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
import { Textarea } from '@/components/ui/textarea';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { OrderStatusBadge, allOrderStatuses, getStatusButtonClassName } from '@/components/orders/OrderStatusBadge';
import { EditOrderDialog } from '@/components/orders/EditOrderDialog';
import { BulkShipOrderDialog } from '@/components/orders/BulkShipOrderDialog';
import { ImportProgressDialog, ImportOrder } from '@/components/orders/ImportProgressDialog';
import { useUpdateOrderStatus, OrderWithItems } from '@/hooks/useOrders';
import { useExpeditionOrders } from '@/hooks/useExpeditionOrders';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { getWilayaLabel, algeriaWilayas } from '@/data/algeriaLocations';
import { writeExcelFile } from '@/lib/excel';

import { ChatPanel } from '@/components/orders/ChatPanel';
import { PrintBordereauDialog } from '@/components/orders/PrintBordereauDialog';
import { printBordereaux } from '@/components/orders/printBordereaux';
import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';

type FilterStatus = 'all' | 'confirmed' | 'preparing' | 'ready' | 'to_station' | 'error';
const DELIVERY_COMPANIES = ['RJ360', 'ZR Express', 'Maystro'] as const;

export default function Expedition() {
  // useOrdersRealtime moved to MainLayout
  const riskMap = useReturnRiskData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedStoreId } = useStoreFilter();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [deliveryCompanyFilter, setDeliveryCompanyFilter] = useState<string[]>([]);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkShipOpen, setBulkShipOpen] = useState(false);
  const [importProgressOpen, setImportProgressOpen] = useState(false);
  const [ordersToImport, setOrdersToImport] = useState<ImportOrder[]>([]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const { data: allOrders, isLoading } = useExpeditionOrders(selectedStoreId);
  const { data: confirmationLogs } = useAutoConfirmationLogs();
  const updateStatus = useUpdateOrderStatus();

  const phoneNumbers = useMemo(() => {
    if (!allOrders) return [];
    return [...new Set(allOrders.map(o => o.customer_phone).filter(Boolean))] as string[];
  }, [allOrders]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);

  // Expedition-related statuses (orders ready to ship) - shipped orders go to Tracking
  const expeditionStatuses = ['confirmed', 'preparing', 'ready', 'to_station', 'erreur'];
  
  // Available statuses for changing in expedition - ordered: En Préparation → Prêt → Vers station → Erreur
  const availableStatuses = [
    { value: 'preparing', label: 'En Préparation' },
    { value: 'ready', label: 'Prêt' },
    { value: 'to_station', label: 'Vers station' },
    { value: 'erreur', label: 'Erreur' },
  ];

  // Calculate counts for each filter category
  const statusCounts = useMemo(() => {
    if (!allOrders) return { confirmed: 0, preparing: 0, ready: 0, to_station: 0, error: 0 };
    
    // Orders in expedition statuses: exclude shipped_at ONLY for confirmed/preparing/ready/erreur.
    // to_station orders should ALWAYS show here even if shipped_at is set (parcel not yet picked up).
    const expeditionOrders = allOrders.filter(
      (o) => expeditionStatuses.includes(o.status) && (o.status === 'to_station' || !o.shipped_at)
    );
    
    return {
      confirmed: expeditionOrders.filter(o => o.status === 'confirmed').length,
      preparing: expeditionOrders.filter(o => o.status === 'preparing').length,
      ready: expeditionOrders.filter(o => o.status === 'ready').length,
      to_station: expeditionOrders.filter(o => o.status === 'to_station').length,
      error: expeditionOrders.filter(o => o.status === 'erreur').length,
    };
  }, [allOrders]);

  // Filter orders based on active filter, delivery company and search
  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    
    // First, filter to only expedition-related statuses
    // to_station orders always show here even with shipped_at set (parcel not yet picked up).
    let filtered = allOrders.filter(o => expeditionStatuses.includes(o.status) && (o.status === 'to_station' || !o.shipped_at));
    
    // Apply status filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'error') {
        filtered = filtered.filter(o => o.status === 'erreur');
      } else if (activeFilter === 'to_station') {
        filtered = filtered.filter(o => o.status === 'to_station');
      } else {
        filtered = filtered.filter(o => o.status === activeFilter);
      }
    }
    
    // Apply delivery company filter (multi-select)
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
        o.order_items.some(item => item.product_name.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allOrders, activeFilter, deliveryCompanyFilter, deliveryTypeFilter, searchQuery]);

  // Count for "Tous" tab - only expedition statuses
  const expeditionTotalCount = useMemo(() => {
    if (!allOrders) return 0;
    return allOrders.filter(o => expeditionStatuses.includes(o.status) && (o.status === 'to_station' || !o.shipped_at)).length;
  }, [allOrders]);

  const filterTabs = [
    { key: 'all' as FilterStatus, label: 'Tous', icon: List, count: expeditionTotalCount, color: 'bg-slate-500' },
    { key: 'confirmed' as FilterStatus, label: 'Confirmé', icon: CheckCircle, count: statusCounts.confirmed, color: 'bg-green-500' },
    { key: 'preparing' as FilterStatus, label: 'En Préparation', icon: Box, count: statusCounts.preparing, color: 'bg-orange-500' },
    { key: 'ready' as FilterStatus, label: 'Prêt', icon: PackageCheck, count: statusCounts.ready, color: 'bg-cyan-500' },
    { key: 'to_station' as FilterStatus, label: 'Vers Station', icon: Building, count: statusCounts.to_station, color: 'bg-violet-500' },
    { key: 'error' as FilterStatus, label: 'Erreur', icon: AlertTriangle, count: statusCounts.error, color: 'bg-red-500' },
  ];
  
  const agentStats = {
    total: expeditionTotalCount,
    confirmed: statusCounts.confirmed,
    preparing: statusCounts.preparing,
    ready: statusCounts.ready,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const handleStatusChange = async (order: OrderWithItems, newStatus: string) => {
    // Prevent double-click / concurrent processing
    if (processingOrderIds.has(order.id)) return;
    setProcessingOrderIds(prev => new Set(prev).add(order.id));
    try {
      // For local livreur orders going to "en_livraison", set shipped_at
      const isLocalLivreur = (order.delivery_company || '').startsWith('local:');
      if (isLocalLivreur && newStatus === 'en_livraison') {
        // Guard against race conditions: re-check the current status from DB before overwriting.
        // The livreur may have already voted on the WhatsApp poll (delivered / Échec / etc.)
        // between the moment the button was rendered and the moment it was clicked.
        const { data: fresh } = await supabase
          .from('orders')
          .select('status')
          .eq('id', order.id)
          .maybeSingle();
        const TERMINAL = ['delivered', 'delivered_paid', 'returned', 'Échec_de_livraison', 'cancelled'];
        if (fresh && TERMINAL.includes(fresh.status as string)) {
          toast({
            title: 'Action ignorée',
            description: `La commande ${order.order_number} est déjà "${fresh.status}".`,
            variant: 'destructive',
          });
          await queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
          return;
        }
        await supabase
          .from('orders')
          .update({ status: 'en_livraison', shipped_at: new Date().toISOString() })
          .eq('id', order.id);
        await queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
        toast({
          title: 'Statut mis à jour',
          description: `Commande ${order.order_number} → En livraison`,
        });
        return;
      }

      await updateStatus.mutateAsync({
        id: order.id,
        status: newStatus as any,
      });
      toast({
        title: 'Statut mis à jour',
        description: `Commande ${order.order_number} → ${allOrderStatuses.find(s => s.value === newStatus)?.label}`,
      });

      // If a local livreur order goes to "erreur", delete the WhatsApp poll sent earlier
      if (newStatus === 'erreur' && (order.delivery_company || '').startsWith('local:')) {
        try {
          const { data, error } = await supabase.functions.invoke('delete-livreur-poll', {
            body: { order_id: order.id },
          });
          if (error) {
            console.error('delete-livreur-poll error:', error);
          } else {
            console.log('delete-livreur-poll result:', data);
          }
        } catch (e) {
          console.error('delete-livreur-poll invocation failed:', e);
        }
      }

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
              queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
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
    } finally {
      setProcessingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (isBulkProcessing) return;
    setIsBulkProcessing(true);
    try {
    const ordersToProcess = filteredOrders.filter(o => selectedOrders.includes(o.id));
    let successCount = 0;
    let failCount = 0;

    for (const orderId of selectedOrders) {
      try {
        await updateStatus.mutateAsync({
          id: orderId,
          status: newStatus as any,
        });
        successCount++;
      } catch (error: unknown) {
        failCount++;
        console.error(`Failed to update order ${orderId}:`, error);
      }
    }

    if (successCount > 0) {
      toast({
        title: 'Statuts mis à jour',
        description: failCount > 0
          ? `${successCount} commande(s) → ${allOrderStatuses.find(s => s.value === newStatus)?.label}, ${failCount} échouée(s)`
          : `${successCount} commande(s) → ${allOrderStatuses.find(s => s.value === newStatus)?.label}`,
      });
    }

    if (failCount > 0 && successCount === 0) {
      toast({
        title: 'Erreur',
        description: `Impossible de mettre à jour les ${failCount} commande(s). Veuillez réessayer.`,
        variant: 'destructive',
      });
    }

    // Auto-import to delivery companies for orders changing to "preparing"
    // ZR Express is handled by backend trigger; only invoke RJ360 directly.
    if (newStatus === 'preparing') {
      const importableOrders = ordersToProcess.filter(o => 
        o.delivery_company === 'RJ360' && !o.tracking_number
      );
      for (const order of importableOrders) {
        try {
          await supabase.functions.invoke('ecotrack-create-order', {
            body: { record: { ...order, status: 'preparing' } },
          });
        } catch (e) {
          console.error(`${order.delivery_company} import failed for ${order.order_number}:`, e);
        }
      }
      if (importableOrders.length > 0) {
        toast({
          title: '📦 Import livraison',
          description: `${importableOrders.length} commande(s) importée(s)`,
        });
        queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
      }
    }

    setSelectedOrders([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeliveryCompanyChange = async (company: string) => {
    try {
      for (const orderId of selectedOrders) {
        await supabase
          .from('orders')
          .update({ delivery_company: company })
          .eq('id', orderId);
      }
      await queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
      toast({
        title: 'Société de livraison mise à jour',
        description: `${selectedOrders.length} commande(s) → ${company}`,
      });
      setSelectedOrders([]);
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

  // Only confirmed orders can be imported (sent to delivery company for the first time)
  const canImportOrder = (status: string) => {
    return status === 'confirmed';
  };

  // Separate orders: those with delivery_company (auto-import) vs those without (need dialog)
  const { ordersWithCompany, ordersWithoutCompany } = useMemo(() => {
    const importableOrders = filteredOrders.filter(o => selectedOrders.includes(o.id) && canImportOrder(o.status));
    return {
      ordersWithCompany: importableOrders.filter(o => o.delivery_company),
      ordersWithoutCompany: importableOrders.filter(o => !o.delivery_company),
    };
  }, [filteredOrders, selectedOrders]);

  // Orders without company go to the dialog for selection
  const shippableSelectedOrders = useMemo(() => {
    return ordersWithoutCompany.map(o => ({ id: o.id, orderNumber: o.order_number, customerName: o.customer_name }));
  }, [ordersWithoutCompany]);

  // Import a single order (used by ImportProgressDialog)
  const importSingleOrder = useCallback(async (order: ImportOrder) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Non connecté');
    }

    const { error } = await supabase.functions.invoke('ship-order', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { order_id: order.id, delivery_company: order.deliveryCompany },
    });
    
    if (error) throw error;
  }, []);

  // Handle bulk import: show progress dialog
  const handleBulkImport = useCallback(async () => {
    // Prepare orders for import (only those with delivery company)
    const ordersForImport: ImportOrder[] = ordersWithCompany.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      deliveryCompany: o.delivery_company || '',
    }));

    if (ordersForImport.length > 0) {
      setOrdersToImport(ordersForImport);
      setImportProgressOpen(true);
    }
    
    // Open BulkShipDialog for orders without a company
    if (ordersWithoutCompany.length > 0) {
      setBulkShipOpen(true);
    } else if (ordersForImport.length === 0) {
      // No orders to import
      toast({ title: 'Info', description: 'Aucune commande à importer' });
    }
  }, [ordersWithCompany, ordersWithoutCompany.length, toast]);

  const handleImportComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
    setSelectedOrders([]);
    setOrdersToImport([]);
  }, [queryClient]);

  // Get wilaya code from name or code
  const getWilayaCode = useCallback((wilaya: string): number | string => {
    if (!wilaya) return '';
    
    // If it's already a number, return it
    const parsed = parseInt(wilaya, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 58) {
      return parsed;
    }
    
    // Find by name (case-insensitive)
    const found = algeriaWilayas.find(
      w => w.name.toLowerCase() === wilaya.toLowerCase()
    );
    
    return found ? parseInt(found.code, 10) : '';
  }, []);

  // Format order data for RJ360 Excel format - exact column headers from RJ360 template
  const formatForRJ360 = useCallback((order: OrderWithItems) => {
    const products = order.order_items
      ?.map(item => `${item.product_name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity}`)
      .join(', ') || '';
    
    // Get wilaya code from name or code
    const wilayaCode = getWilayaCode(order.wilaya);
    
    return {
      'reference commande': order.order_number || '',
      'nom et prenom du destinataire*': order.customer_name || '',
      'telephone*': order.customer_phone || '',
      'telephone 2': '',
      'code wilaya*': wilayaCode,
      'wilaya de livraison': getWilayaLabel(order.wilaya) || '',
      'commune de livraison*': order.commune || '',
      'adresse de livraison*': order.customer_address || '',
      'produit*': products,
      'poids (kg)': '',
      'montant du colis*': order.total_price || 0,
      'remarque': order.notes || '',
      'FRAGILE( si oui mettez OUI sinon laissez vide )': 'OUI',
      'ECHANGE( si oui mettez OUI sinon laissez vide )': '',
      'PICK UP( si oui mettez OUI sinon laissez vide )': '',
      'RECOUVREMENT( si oui mettez OUI sinon laissez vide )': '',
      'STOP DESK( si oui mettez OUI sinon laissez vide )': order.delivery_type === 'stop_desk' ? 'OUI' : '',
      'Lien map': '',
    };
  }, [getWilayaCode]);

  // Format order data for default Excel format
  const formatForDefault = useCallback((order: OrderWithItems) => {
    const products = order.order_items
      ?.map(item => `${item.product_name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity}`)
      .join(', ') || '';
    
    return {
      'N° Commande': order.order_number,
      'Client': order.customer_name,
      'Téléphone': order.customer_phone,
      'Adresse': order.customer_address,
      'Wilaya': getWilayaLabel(order.wilaya),
      'Commune': order.commune || '',
      'Type Livraison': order.delivery_type === 'home' ? 'Domicile' : 'Stop Desk',
      'Société Livraison': order.delivery_company || '',
      'Produits': products,
      'Frais Livraison': order.delivery_fee,
      'Total': order.total_price,
      'N° Suivi': order.tracking_number || '',
      'Statut': allOrderStatuses.find(s => s.value === order.status)?.label || order.status,
      'Notes': order.notes || '',
    };
  }, []);

  // Export selected orders to Excel
  const handleExportExcel = useCallback(async () => {
    // Get selected orders from filtered list
    const ordersToExport = filteredOrders.filter(o => selectedOrders.includes(o.id));
    
    if (ordersToExport.length === 0) {
      toast({ title: 'Info', description: 'Sélectionnez des commandes à exporter' });
      return;
    }

    setIsExportingExcel(true);
    try {
      // Separate orders by delivery company
      const rj360Orders = ordersToExport.filter(o => o.delivery_company === 'RJ360');
      const otherOrders = ordersToExport.filter(o => o.delivery_company !== 'RJ360');
      
      const now = new Date();
      const day = now.getDate();
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const month = monthNames[now.getMonth()];
      const year = now.getFullYear();
      const date = `${day}-${month}-${year}`;
      
      const sheets: { name: string; data: Record<string, any>[] }[] = [];
      
      if (rj360Orders.length > 0) {
        sheets.push({ name: 'RJ360', data: rj360Orders.map(formatForRJ360) });
      }
      
      if (otherOrders.length > 0) {
        sheets.push({ name: 'Autres', data: otherOrders.map(formatForDefault) });
      }
      
      // Generate filename based on delivery company
      const uniqueCompanies = [...new Set(ordersToExport.map(o => o.delivery_company).filter(Boolean))];
      
      let filename: string;
      if (uniqueCompanies.length === 1) {
        const companyName = (uniqueCompanies[0] as string)?.replace(/\s+/g, '-') || 'unknown';
        filename = `Orders-${companyName}-${date}.xlsx`;
      } else {
        filename = `Orders-mixed-${date}.xlsx`;
      }
      
      await writeExcelFile(sheets, filename);
      
      toast({ title: 'Succès', description: `${ordersToExport.length} commande(s) exportée(s)` });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({ title: 'Erreur', description: 'Erreur lors de l\'export', variant: 'destructive' });
    } finally {
      setIsExportingExcel(false);
    }
  }, [filteredOrders, selectedOrders, toast, formatForRJ360, formatForDefault]);

  // Total importable orders count
  const totalImportableCount = ordersWithCompany.length + ordersWithoutCompany.length;

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

            {/* Action Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2" disabled={!isSomeSelected}>
                  Actions {isSomeSelected && `(${selectedOrders.length})`}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border shadow-xl z-[200] w-[220px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <DropdownMenuItem className="cursor-pointer justify-between" onSelect={(e) => e.preventDefault()}>
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Changer le statut
                      </span>
                      <ChevronDown className="h-3 w-3 -rotate-90" />
                    </DropdownMenuItem>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" className="bg-popover border border-border shadow-xl z-[201] w-[180px]">
                    {availableStatuses.map((status) => (
                      <DropdownMenuItem
                        key={status.value}
                        onClick={() => handleBulkStatusChange(status.value)}
                        className="cursor-pointer"
                      >
                        <OrderStatusBadge status={status.value as any} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <DropdownMenuItem className="cursor-pointer justify-between" onSelect={(e) => e.preventDefault()}>
                      <span className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Changer la société
                      </span>
                      <ChevronDown className="h-3 w-3 -rotate-90" />
                    </DropdownMenuItem>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" className="bg-popover border border-border shadow-xl z-[201] w-[180px]">
                    <DropdownMenuItem onClick={() => handleBulkDeliveryCompanyChange('RJ360')} className="cursor-pointer">
                      <DeliveryCompanyBadge company="RJ360" />
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkDeliveryCompanyChange('ZR Express')} className="cursor-pointer">
                      <DeliveryCompanyBadge company="ZR Express" />
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkDeliveryCompanyChange('Maystro')} className="cursor-pointer">
                      <DeliveryCompanyBadge company="Maystro" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
                    onClick={() => { setActiveFilter(isActive ? 'all' : tab.key); setSelectedOrders([]); }}
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

      {/* Action bar when orders are selected */}
      {isSomeSelected && (() => {
        const selected = filteredOrders.filter(o => selectedOrders.includes(o.id));
        const confirmedCount = selected.filter(o => o.status === 'confirmed').length;
        const preparingCount = selected.filter(o => o.status === 'preparing').length;
        const readyNonLocal = selected.filter(o => o.status === 'ready' && !(o.delivery_company || '').startsWith('local:'));
        const readyLocal = selected.filter(o => o.status === 'ready' && (o.delivery_company || '').startsWith('local:'));
        const readyNonLocalCount = readyNonLocal.length;
        const readyLocalCount = readyLocal.length;
        // Determine dominant color based on selected statuses
        const borderColor = confirmedCount > 0 ? 'border-orange-400 dark:border-orange-600' 
          : preparingCount > 0 ? 'border-cyan-400 dark:border-cyan-600' 
          : (readyNonLocalCount + readyLocalCount) > 0 ? 'border-violet-400 dark:border-violet-600' 
          : 'border-border';
        const bgColor = confirmedCount > 0 ? 'bg-orange-50/50 dark:bg-orange-950/20' 
          : preparingCount > 0 ? 'bg-cyan-50/50 dark:bg-cyan-950/20' 
          : (readyNonLocalCount + readyLocalCount) > 0 ? 'bg-violet-50/50 dark:bg-violet-950/20' 
          : 'bg-muted/30';

        const handleBulkLocalExpedier = async () => {
          try {
            const TERMINAL = ['delivered', 'delivered_paid', 'returned', 'Échec_de_livraison', 'cancelled'];
            for (const order of readyLocal) {
              const { data: fresh } = await supabase
                .from('orders')
                .select('status')
                .eq('id', order.id)
                .maybeSingle();
              if (fresh && TERMINAL.includes(fresh.status as string)) continue;
              await supabase
                .from('orders')
                .update({ status: 'en_livraison', shipped_at: new Date().toISOString() })
                .eq('id', order.id);
            }
            await queryClient.invalidateQueries({ queryKey: ['orders-expedition'] });
            toast({
              title: 'Expédié',
              description: `${readyLocalCount} commande(s) → En livraison`,
            });
            setSelectedOrders([]);
          } catch (error: unknown) {
            toast({
              title: 'Erreur',
              description: getOrderErrorMessage(error),
              variant: 'destructive',
            });
          }
        };

        return (
          <div className={`rounded-lg border ${borderColor} ${bgColor} px-5 py-3 flex items-center justify-between flex-shrink-0`}>
            <span className="text-sm font-medium text-foreground">
              {selectedOrders.length} commande(s) sélectionnée(s)
            </span>
            <div className="flex items-center gap-2">
              {confirmedCount > 0 && (
                <Button
                  onClick={handleBulkImport}
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-2 px-5"
                >
                  <Truck className="h-4 w-4" />
                  Importer ({confirmedCount})
                </Button>
              )}
              {preparingCount > 0 && (
                <Button
                  onClick={() => handleBulkStatusChange('ready')}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 px-5"
                >
                  <PackageCheck className="h-4 w-4" />
                  Prêt ({preparingCount})
                </Button>
              )}
              {readyNonLocalCount > 0 && (
                <Button
                  onClick={() => handleBulkStatusChange('to_station')}
                  className="bg-violet-500 hover:bg-violet-600 text-white gap-2 px-5"
                >
                  <Building className="h-4 w-4" />
                  Vers station ({readyNonLocalCount})
                </Button>
              )}
              {readyLocalCount > 0 && (
                <Button
                  onClick={handleBulkLocalExpedier}
                  className="bg-blue-500 hover:bg-blue-600 text-white gap-2 px-5"
                >
                  <Truck className="h-4 w-4" />
                  Expédier ({readyLocalCount})
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setSelectedOrders([])}
              >
                Annuler
              </Button>
            </div>
          </div>
        );
      })()}


      {/* Orders Table */}
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
              <div className="min-w-[1300px]">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b sticky top-0 z-20 bg-border">
                    <tr className="border-b border-border transition-colors [&_th]:text-foreground [&_th]:font-semibold">
                      {activeFilter !== 'all' && (
                        <th className="h-12 px-4 align-middle text-muted-foreground w-[50px]">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                      )}
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">N° Commande</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[180px]">Informations destinataire</th>
                      <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[180px]">Adresse destinataire</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Produit</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Total</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[100px]">Type Livraison</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[140px]">Statut</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[120px]">Remarque</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[150px]">Actions</th>
                    </tr>
                  </thead>
                  <TableBody>
                    {filteredOrders.map((order, index) => (
                      <TableRow 
                        key={order.id} 
                        className={`
                          hover:bg-muted/30 transition-colors [&_td]:py-[3.5px]
                          ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                          ${selectedOrders.includes(order.id) ? 'bg-primary/5' : ''}
                        `}
                      >
                        {activeFilter !== 'all' && (
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => handleSelectOrder(order.id)}
                            />
                          </TableCell>
                        )}
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
                            <Button 
                              size="sm" 
                              variant="outline"
                              className={`w-full justify-center text-xs h-8 pointer-events-none ${getStatusButtonClassName(order.status as any)}`}
                            >
                              <span className="truncate">
                                {allOrderStatuses.find(s => s.value === order.status)?.label}
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <SuiviPopover order={order} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <StatusHistoryPopover order={order} />
                            {(order.status === 'confirmed' || order.status === 'erreur') && (
                              <EditOrderDialog order={order as any} expeditionOnly hideStatus />
                            )}
                            <PrintBordereauDialog order={order} />
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
              <Truck className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Aucune commande à expédier!</p>
              <p className="text-muted-foreground">Toutes les commandes confirmées ont été expédiées.</p>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Ship Order Dialog */}
      <BulkShipOrderDialog
        open={bulkShipOpen}
        onOpenChange={setBulkShipOpen}
        orders={shippableSelectedOrders}
        onComplete={() => setSelectedOrders([])}
      />

      {/* Import Progress Dialog */}
      <ImportProgressDialog
        open={importProgressOpen}
        onOpenChange={setImportProgressOpen}
        orders={ordersToImport}
        onImport={importSingleOrder}
        onComplete={handleImportComplete}
      />

    </div>
  );
}
