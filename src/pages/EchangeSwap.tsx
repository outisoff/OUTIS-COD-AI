import { useState, useMemo, useEffect } from 'react';
import { useEchangeOrders, useEligibleOrderSearch, useSwappedOrders, useSwapEligibleOrders, useSwapTargetSearch, useGlobalOrderSearch } from '@/hooks/useEchangeOrders';

import type { OrderWithItems } from '@/hooks/useOrders';
import { phoneMatchesQuery } from '@/lib/phoneSearch';
import { useStoreFilter } from '@/contexts/StoreFilterContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  Search, RefreshCw, Plus, Trash2, ArrowLeftRight,
  User, MapPin, Building2, Home, List
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getWilayaLabel } from '@/data/algeriaLocations';
import { DeliveryCompanyBadge } from '@/components/orders/DeliveryCompanyBadge';
import { StopDeskInfoPopover } from '@/components/orders/StopDeskInfoPopover';
import { StatusHistoryPopover } from '@/components/orders/StatusHistoryPopover';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ChatPanel } from '@/components/orders/ChatPanel';
import { WhatsAppPhoneIndicator } from '@/components/orders/WhatsAppPhoneIndicator';
import { useCheckWhatsApp } from '@/hooks/useCheckWhatsApp';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';
import { ReturnRiskBadge } from '@/components/orders/ReturnRiskBadge';
import { useReturnRiskData } from '@/hooks/useReturnRisk';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { MessageCircle } from 'lucide-react';

function EchangeChatButton({ order, whatsappStatus }: { order: OrderWithItems; whatsappStatus?: Record<string, boolean | null> | null }) {
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
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-70 cursor-not-allowed" disabled>
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

const SWAP_ELIGIBLE_STATUSES = ['failed_3', 'cancelled'] as const;


const EchangeSwap = () => {
  const { selectedStoreId } = useStoreFilter();
  const { data: echangeOrders, isLoading: isLoadingEchange } = useEchangeOrders(selectedStoreId);
  const { data: swappedOrders, isLoading: isLoadingSwaps } = useSwappedOrders(selectedStoreId);
  const { data: swapEligibleOrders, isLoading: isLoadingEligible } = useSwapEligibleOrders(selectedStoreId);
  const riskMap = useReturnRiskData();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'echange' | 'swaps' | 'eligible'>('swaps');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'echange' | 'swap'>('echange');
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const newStatus = 'exchange';
  const [submitting, setSubmitting] = useState(false);
  const [orderToRemove, setOrderToRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const [swapOrder, setSwapOrder] = useState<OrderWithItems | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [targetSearch, setTargetSearch] = useState('');
  const [debouncedTargetSearch, setDebouncedTargetSearch] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedOrderSearch(orderSearch), 300);
    return () => clearTimeout(t);
  }, [orderSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTargetSearch(targetSearch), 300);
    return () => clearTimeout(t);
  }, [targetSearch]);

  const { data: eligibleOrdersRaw } = useEligibleOrderSearch(debouncedOrderSearch, selectedStoreId, createMode);
  const { data: targetOrdersRaw } = useSwapTargetSearch(debouncedTargetSearch, selectedStoreId, !!swapOrder);
  const targetOrders = useMemo(() => {
    if (!swapOrder || !targetOrdersRaw) return targetOrdersRaw;
    const keyOf = (items: any[]) => {
      const map = new Map<string, number>();
      (items || []).forEach(i => {
        const k = `${i.product_id || ''}::${i.products?.sku || ''}`;
        if (k === '::') return;
        map.set(k, (map.get(k) || 0) + (Number(i.quantity) || 1));
      });
      return [...map.entries()].map(([k, q]) => `${k}x${q}`).sort().join('|');
    };
    const sourceKey = keyOf(swapOrder.order_items || []);
    if (!sourceKey) return targetOrdersRaw;
    return targetOrdersRaw.filter(o => keyOf(o.order_items || []) === sourceKey);
  }, [targetOrdersRaw, swapOrder]);

  const orders = activeTab === 'echange' ? echangeOrders : activeTab === 'swaps' ? swappedOrders : swapEligibleOrders;
  const isLoading = activeTab === 'echange' ? isLoadingEchange : activeTab === 'swaps' ? isLoadingSwaps : isLoadingEligible;

  const phoneNumbers = useMemo(() => {
    if (!orders) return [];
    return [...new Set(orders.map(o => o.customer_phone).filter(Boolean))];
  }, [orders]);
  const { data: whatsappStatus } = useCheckWhatsApp(phoneNumbers);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data: globalSearchResults } = useGlobalOrderSearch(debouncedSearch, selectedStoreId, !!search);

  const filteredOrders = useMemo(() => {
    const list = orders ?? [];
    const matches = (o: OrderWithItems) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        o.customer_name?.toLowerCase().includes(s) ||
        phoneMatchesQuery(o.customer_phone, s) ||
        o.order_number?.toLowerCase().includes(s) ||
        o.wilaya?.toLowerCase().includes(s) ||
        o.tracking_number?.toLowerCase().includes(s)
      );
    };
    const filtered = list.filter(matches);
    if (!search || !globalSearchResults?.length) return filtered;
    const existingIds = new Set(filtered.map(o => o.id));
    const extras = globalSearchResults.filter(o => !existingIds.has(o.id));
    return [...filtered, ...extras];
  }, [orders, search, globalSearchResults]);


  const eligibleOrdersAll = eligibleOrdersRaw || [];
  const eligibleOrders = eligibleOrdersAll;
  const selectedOrder = [...(echangeOrders || []), ...eligibleOrdersAll].find(o => o.id === selectedOrderId);
  const selectedTarget = (targetOrders || []).find(o => o.id === selectedTargetId);
  const echangeCount = echangeOrders?.length ?? 0;
  const swapsCount = swappedOrders?.length ?? 0;
  const eligibleCount = swapEligibleOrders?.length ?? 0;

  const handleSubmit = async () => {
    if (!selectedOrderId) { toast.error('Veuillez sélectionner une commande'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrderId);
      if (error) throw error;
      toast.success('Commande marquée comme échange');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setDialogOpen(false);
      setSelectedOrderId(null);
      setOrderSearch('');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFromExchange = async () => {
    if (!orderToRemove) return;
    setRemoving(true);
    try {
      if (activeTab === 'swaps') {
        // Revert swap: restore source order's tracking + original status, reset target to confirmed
        const targetId = orderToRemove;

        // 1) Find latest swap-target history row for this target
        const { data: tgtHist, error: thErr } = await supabase
          .from('order_history')
          .select('id, notes, created_at')
          .eq('order_id', targetId)
          .eq('changed_by', 'ZR Express Swap')
          .ilike('notes', 'Swap manuel ←%')
          .order('created_at', { ascending: false })
          .limit(1);
        if (thErr) throw thErr;
        if (!tgtHist || tgtHist.length === 0) throw new Error('Historique du swap introuvable');

        const note = tgtHist[0].notes || '';
        const m = note.match(/tracking\s+(\S+)\s+re[çc]u depuis\s+(\S+)/i);
        if (!m) throw new Error('Impossible de lire le tracking dans l\'historique');
        const tracking = m[1];
        const sourceOrderNumber = m[2];

        // 2) Find source order by order_number
        const { data: srcRows, error: srcErr } = await supabase
          .from('orders')
          .select('id, status, order_number')
          .eq('order_number', sourceOrderNumber)
          .limit(1);
        if (srcErr) throw srcErr;
        if (!srcRows || srcRows.length === 0) throw new Error('Commande source introuvable');
        const sourceOrder = srcRows[0];

        // 3) Find source's swap-history row to get original status
        const { data: srcHist, error: shErr } = await supabase
          .from('order_history')
          .select('id, old_status, notes, created_at')
          .eq('order_id', sourceOrder.id)
          .eq('changed_by', 'ZR Express Swap')
          .ilike('notes', `Swap manuel → tracking ${tracking}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (shErr) throw shErr;
        const originalStatus = srcHist?.[0]?.old_status || 'Échec_de_livraison';

        const nowIso = new Date().toISOString();

        // 4) Revert target: clear tracking + back to confirmed
        const { error: tUpdErr } = await supabase.from('orders').update({
          tracking_number: null,
          delivery_company: null,
          status: 'confirmed',
          updated_at: nowIso,
        }).eq('id', targetId);
        if (tUpdErr) throw tUpdErr;

        // 5) Revert source: restore tracking + original status
        const { error: sUpdErr } = await supabase.from('orders').update({
          tracking_number: tracking,
          delivery_company: 'ZR Express',
          status: originalStatus,
          updated_at: nowIso,
        }).eq('id', sourceOrder.id);
        if (sUpdErr) throw sUpdErr;

        // 6) Move deliveries row back to source
        await supabase.from('deliveries')
          .update({ order_id: sourceOrder.id, last_update: nowIso })
          .eq('tracking_number', tracking);

        // 7) Log reversal in history (target order_number is already known from the row we're acting on)
        const { data: tgtOrderRow } = await supabase.from('orders').select('order_number').eq('id', targetId).maybeSingle();
        const targetOrderNumber = tgtOrderRow?.order_number ?? 'cible';
        await supabase.from('order_history').insert([
          { order_id: sourceOrder.id, old_status: 'cancelled', new_status: originalStatus, changed_by: 'ZR Express Swap',
            notes: `Swap annulé ↩ tracking ${tracking} restauré depuis ${targetOrderNumber}` },
          { order_id: targetId, old_status: 'shipped', new_status: 'confirmed', changed_by: 'ZR Express Swap',
            notes: `Swap annulé ↩ tracking ${tracking} renvoyé vers ${sourceOrderNumber}` },
        ]);

        toast.success('Swap annulé — commandes restaurées à leur état initial');
      } else {
        const { error } = await supabase.from('orders').update({ status: 'delivered_paid' }).eq('id', orderToRemove);
        if (error) throw error;
        toast.success('Commande retirée des échanges');
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-echange'] });
      queryClient.invalidateQueries({ queryKey: ['orders-swapped-v2'] });
      queryClient.invalidateQueries({ queryKey: ['orders-swap-eligible-v6'] });
      setOrderToRemove(null);
    } catch (err: any) {
      toast.error('Erreur: ' + (err?.message || 'Inconnue'));
    } finally {
      setRemoving(false);
    }
  };

  const openSwapDialog = (order: OrderWithItems) => {
    setSelectedTargetId(null);
    setTargetSearch('');
    setSwapOrder(order);
  };

  const handleSwap = async () => {
    if (!swapOrder) return;
    if (!selectedTargetId) { toast.error('Sélectionnez une commande cible'); return; }
    if (swapOrder.delivery_company !== 'ZR Express' || !swapOrder.tracking_number) {
      toast.error('Swap autorisé uniquement pour les commandes ZR Express avec tracking');
      return;
    }
    setSwapping(true);
    try {
      const tracking = swapOrder.tracking_number as string;
      const nowIso = new Date().toISOString();

      // Transfer tracking to target → shipped
      const { error: tErr } = await supabase.from('orders').update({
        tracking_number: tracking,
        delivery_company: 'ZR Express',
        status: 'shipped',
        updated_at: nowIso,
      }).eq('id', selectedTargetId);
      if (tErr) throw tErr;

      // Clear source tracking + cancel
      const srcUpdate: Database['public']['Tables']['orders']['Update'] = { tracking_number: null, updated_at: nowIso };
      if (swapOrder.status !== 'cancelled') srcUpdate.status = 'cancelled';
      const { error: sErr } = await supabase.from('orders').update(srcUpdate).eq('id', swapOrder.id);
      if (sErr) throw sErr;

      // Move delivery row
      await supabase.from('deliveries')
        .update({ order_id: selectedTargetId, last_update: nowIso })
        .eq('tracking_number', tracking);

      // History
      await supabase.from('order_history').insert([
        { order_id: swapOrder.id, old_status: swapOrder.status, new_status: 'cancelled', changed_by: 'ZR Express Swap',
          notes: `Swap manuel → tracking ${tracking} transféré vers ${selectedTarget?.order_number ?? 'cible'}` },
        { order_id: selectedTargetId, old_status: 'confirmed', new_status: 'shipped', changed_by: 'ZR Express Swap',
          notes: `Swap manuel ← tracking ${tracking} reçu depuis ${swapOrder.order_number}` },
      ]);

      toast.success(`Swap enregistré ✅ — pensez à le valider manuellement sur ZR Express`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-echange'] });
      queryClient.invalidateQueries({ queryKey: ['orders-swapped-v2'] });
      queryClient.invalidateQueries({ queryKey: ['orders-swap-eligible-v6'] });
      queryClient.invalidateQueries({ queryKey: ['orders-swap-targets'] });
      setSwapOrder(null);
      setSelectedTargetId(null);
      setTargetSearch('');
    } catch (err: any) {
      toast.error('Erreur Swap: ' + (err?.message || 'Inconnue'));
    } finally {
      setSwapping(false);
    }
  };



  const formatCurrency = (amount: number) => `${amount.toLocaleString()} DA`;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in gap-4 overflow-hidden">
      {/* Search + Stats Bar */}
      <Card className="p-4 flex-shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Rechercher par N°, nom, téléphone, wilaya..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                autoComplete="new-password"
              />
            </div>
            <Button onClick={() => setChooserOpen(true)} className="gap-2 h-9 rounded-lg">
              <Plus className="h-4 w-4" />
              Nouvelle commande
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('swaps')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'swaps' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="font-medium">Mes Swaps</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-blue-500">{swapsCount}</span>
            </button>
            <button
              onClick={() => setActiveTab('echange')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'echange' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="font-medium">Échange</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-purple-500">{echangeCount}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 min-h-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="h-full overflow-auto">
              <div className="min-w-[1200px]">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b sticky top-0 z-20 bg-border">
                    <tr className="border-b border-border transition-colors [&_th]:text-foreground [&_th]:font-semibold">
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[110px]">N° Commande</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Destinataire</th>
                      <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[200px]">Adresse</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[200px]">Produit</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[110px]">Total</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[140px]">Livraison</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[120px]">Statut</th>
                      <th className="h-12 px-4 text-center align-middle font-semibold text-muted-foreground w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <TableBody>
                    {filteredOrders.map((order, index) => (
                      <TableRow
                        key={order.id}
                        className={`hover:bg-muted/30 transition-colors [&_td]:py-[3.5px] ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                      >
                        <TableCell className="text-center">
                          <div className="font-mono text-[15px] font-bold text-primary">
                            ORD-{order.order_number.replace(/\D/g, '').padStart(5, '0').slice(-5)}
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {format(new Date(order.created_at), 'dd-MMM-yy', { locale: fr })}
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
                            {(() => {
                              const risk = riskMap.get(order.customer_phone);
                              const isDup = risk && risk.activeOrderIds.length > 1;
                              return risk ? (
                                <ReturnRiskBadge
                                  riskLevel={risk.riskLevel} returnRate={risk.returnRate}
                                  totalOrders={risk.totalOrders} returnedOrders={risk.returnedOrders}
                                  deliveryFailures={risk.deliveryFailures} deliveredOrders={risk.deliveredOrders}
                                  returnedCount={risk.returnedCount} inConfirmation={risk.inConfirmation}
                                  inPreparation={risk.inPreparation} inDelivery={risk.inDelivery}
                                  cancelledOrders={risk.cancelledOrders} isDuplicate={isDup}
                                  duplicateCount={risk.activeOrderIds.length}
                                  customerPhone={order.customer_phone} customerName={order.customer_name}
                                />
                              ) : null;
                            })()}
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
                                {item.product_name}{item.variant && item.variant !== 'cadeau' ? ` (${item.variant})` : ''}{' '}
                                <span className={`font-medium ${item.variant === 'cadeau' ? 'text-green-600' : 'text-primary'}`}>x{item.quantity}</span>
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
                                  <><Home className="h-3 w-3 mr-1" />Domicile</>
                                )}
                              </Badge>
                            </StopDeskInfoPopover>
                            {order.delivery_company && (
                              <DeliveryCompanyBadge company={order.delivery_company} trackingNumber={order.tracking_number} className="text-xs px-2 py-1 w-[100px] justify-center" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <OrderStatusBadge status={order.status as any} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <StatusHistoryPopover order={order} />
                            <EchangeChatButton order={order} whatsappStatus={whatsappStatus} />
                            {SWAP_ELIGIBLE_STATUSES.includes(order.status as any) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openSwapDialog(order)}
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                  >
                                    <ArrowLeftRight className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Swap (Ne répond pas 3 / Annulé)</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setOrderToRemove(order.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Retirer de l'échange</TooltipContent>
                            </Tooltip>
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

      {/* Type Chooser Dialog */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle commande</DialogTitle>
            <DialogDescription>Choisissez le type de commande à créer.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => {
                setCreateMode('echange');
                setSelectedOrderId(null);
                setOrderSearch('');
                setChooserOpen(false);
                setDialogOpen(true);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-border hover:border-purple-500 hover:bg-purple-500/5 p-6 transition-colors"
            >
              <RefreshCw className="h-8 w-8 text-purple-500" />
              <span className="font-semibold">Échange</span>
              <span className="text-xs text-muted-foreground text-center">Marquer une commande comme échange</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMode('swap');
                setSelectedOrderId(null);
                setOrderSearch('');
                setChooserOpen(false);
                setDialogOpen(true);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-border hover:border-blue-500 hover:bg-blue-500/5 p-6 transition-colors"
            >
              <ArrowLeftRight className="h-8 w-8 text-blue-500" />
              <span className="font-semibold">Swap</span>
              <span className="text-xs text-muted-foreground text-center">Swap d'une commande</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exchange / Swap Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{createMode === 'swap' ? 'Nouveau swap' : 'Nouvel échange'}</DialogTitle>
            <DialogDescription>
              {createMode === 'swap'
                ? 'Sélectionnez une commande à swapper.'
                : 'Sélectionnez une commande à marquer comme échange.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rechercher une commande</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="N° commande, nom, téléphone..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="border rounded-md max-h-48 overflow-y-auto">
              {eligibleOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune commande éligible</p>
              ) : (
                eligibleOrders.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent transition-colors border-b last:border-b-0 ${
                      selectedOrderId === o.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div>
                      <span className="font-medium">{o.order_number}</span>
                      <span className="text-muted-foreground ml-2">{o.customer_name}</span>
                    </div>
                    <span className="text-muted-foreground">{o.total_price} DA</span>
                  </button>
                ))
              )}
            </div>

            {selectedOrder && (
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <p><strong>Commande:</strong> {selectedOrder.order_number}</p>
                <p><strong>Client:</strong> {selectedOrder.customer_name}</p>
                <p><strong>Numero:</strong> {selectedOrder.customer_phone}</p>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                  <p><strong>Produits:</strong> {selectedOrder.order_items.map(i => `${i.product_name}${i.variant && i.variant !== 'cadeau' ? ` (${i.variant})` : ''} x${i.quantity}`).join(', ')}</p>
                )}
                <p><strong>Wilaya:</strong> {selectedOrder.wilaya}</p>
                <p><strong>Total:</strong> {selectedOrder.total_price} DA</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                if (createMode === 'swap') {
                  if (!selectedOrder) { toast.error('Veuillez sélectionner une commande'); return; }
                  setDialogOpen(false);
                  openSwapDialog(selectedOrder);
                  setSelectedOrderId(null);
                  setOrderSearch('');
                } else {
                  handleSubmit();
                }
              }}
              disabled={!selectedOrderId || submitting}
              className={createMode === 'swap' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
            >
              {submitting ? 'En cours...' : createMode === 'swap' ? 'Continuer' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!orderToRemove} onOpenChange={(o) => !o && setOrderToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activeTab === 'swaps' ? 'Annuler ce swap ?' : 'Retirer cette commande des échanges ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activeTab === 'swaps'
                ? 'Le tracking sera restauré sur la commande source (statut d\'origine rétabli) et la commande cible reviendra au statut « Confirmé ».'
                : 'La commande sera remise au statut « Livré Payé » et n\'apparaîtra plus dans la liste des échanges.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromExchange}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'En cours...' : 'Retirer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Swap ZR Express Dialog */}
      <Dialog open={!!swapOrder} onOpenChange={(o) => { if (!o) { setSwapOrder(null); setSelectedTargetId(null); setTargetSearch(''); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-600" />
              Swap ZR Express
            </DialogTitle>
            <DialogDescription>
              Transférer le tracking ZR de cette commande vers une autre commande <strong>confirmée</strong>.
              La source passera en <strong>Annulée</strong>, la cible en <strong>Expédiée</strong>.
            </DialogDescription>
          </DialogHeader>

          {swapOrder && (
            <div className="space-y-3 py-2">
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <p className="font-semibold text-destructive">Source (sera annulée)</p>
                <p><strong>Commande:</strong> {swapOrder.order_number}</p>
                {swapOrder.tracking_number && (
                  <p><strong>Tracking ZR:</strong> {swapOrder.tracking_number}</p>
                )}
                <p><strong>Client:</strong> {swapOrder.customer_name}</p>
                <p><strong>Numero:</strong> {swapOrder.customer_phone}</p>
                {swapOrder.order_items && swapOrder.order_items.length > 0 && (
                  <p><strong>Produits:</strong> {swapOrder.order_items.map(i => `${i.product_name}${i.variant && i.variant !== 'cadeau' ? ` (${i.variant})` : ''} x${i.quantity}`).join(', ')}</p>
                )}
                <p><strong>Wilaya:</strong> {swapOrder.wilaya}</p>
                <p><strong>Total:</strong> {swapOrder.total_price} DA</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Commande cible (confirmée, ZR Express)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="N° commande, nom, téléphone..."
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>

                <div className="border rounded-md max-h-56 overflow-y-auto">
                  {(targetOrders || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune commande confirmée disponible
                    </p>
                  ) : (
                    (targetOrders || []).map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSelectedTargetId(o.id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent transition-colors border-b last:border-b-0 ${
                          selectedTargetId === o.id ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{o.order_number}</span>
                          <span className="text-muted-foreground ml-2 truncate">{o.customer_name}</span>
                          <div className="text-xs text-muted-foreground">{o.customer_phone} • {o.wilaya}</div>
                        </div>
                        <span className="text-muted-foreground whitespace-nowrap">{o.total_price} DA</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedTarget && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-800 rounded-md p-3 text-sm space-y-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">Cible (recevra le tracking → Expédiée)</p>
                  <p><strong>Commande:</strong> {selectedTarget.order_number}</p>
                  <p><strong>Client:</strong> {selectedTarget.customer_name}</p>
                  <p><strong>Numero:</strong> {selectedTarget.customer_phone}</p>
                  {selectedTarget.order_items && selectedTarget.order_items.length > 0 && (
                    <p><strong>Produits:</strong> {selectedTarget.order_items.map(i => `${i.product_name}${i.variant && i.variant !== 'cadeau' ? ` (${i.variant})` : ''} x${i.quantity}`).join(', ')}</p>
                  )}
                  <p><strong>Wilaya:</strong> {selectedTarget.wilaya} {selectedTarget.commune ? `— ${selectedTarget.commune}` : ''}</p>
                  <p><strong>Total:</strong> {selectedTarget.total_price} DA — {selectedTarget.delivery_type === 'stop_desk' ? 'Stop Desk' : 'Domicile'}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                ⚠️ Le swap doit être validé manuellement sur ZR Express. Cette action met seulement à jour le système (tracking transféré vers la cible, source annulée).
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOrder(null)} disabled={swapping}>Annuler</Button>
            <Button
              onClick={handleSwap}
              disabled={swapping || !selectedTargetId}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {swapping ? 'Swap en cours...' : 'Confirmer le swap'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EchangeSwap;
