import { useState, useRef } from 'react';
import { History, User, Bot, Truck, Shield, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderWithItems } from '@/hooks/useOrders';
import { useProfilesAndRoles } from '@/hooks/useProfilesAndRoles';

interface StatusHistoryPopoverProps {
  order: OrderWithItems;
}

const statusLabels: Record<string, string> = {
  new: 'Nouveau', validated: 'Validé', confirmed: 'Confirmé', cancelled: 'Annulé',
  failed_1: 'Échoué - 1', failed_2: 'Échoué - 2', failed_3: 'Échoué - 3',
  failed_4: 'Échoué - 4', failed_5: 'Échoué - 5',
  no_answer: 'Répondre pas', wrong_number: 'Faux numéro', postponed: 'Reporter',
  to_reconfirm: 'A reconfirmer', callback: 'Me rappelez', duplicate: 'Dupliquer',
  out_of_stock: 'Fin de stock', ready: 'Prêt', preparing: 'En Préparation',
  to_station: 'Vers station', at_station: 'En station', au_bureau: 'Au bureau',
  en_livraison: 'En livraison', 'Échec_de_livraison': 'Échec de livr',
  shipped: 'Expédié', delivered: 'Livré',
  erreur: 'Erreur', exchange: 'Échange', alerte: 'Alerte',
  delivered_paid: 'Livré Payé', returned: 'Retourné',
};

const transitionLabels: Record<string, string> = {
  failed_1: 'Échoué ( 1 )', failed_2: 'Échoué ( 2 )', failed_3: 'Échoué ( 3 )',
  failed_4: 'Échoué ( 4 )', failed_5: 'Échoué ( 5 )',
};


const statusColorMap: Record<string, { dot: string; bg: string; border: string; badge: string }> = {
  new: { dot: 'from-blue-400 to-blue-500', bg: 'from-blue-50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/20', border: 'border-blue-200/70 dark:border-blue-800/50', badge: 'bg-primary' },
  validated: { dot: 'from-green-400 to-green-500', bg: 'from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20', border: 'border-green-200/70 dark:border-green-800/50', badge: 'bg-green-500' },
  confirmed: { dot: 'from-green-500 to-green-600', bg: 'from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20', border: 'border-green-200/70 dark:border-green-800/50', badge: 'bg-green-600' },
  cancelled: { dot: 'from-red-400 to-red-500', bg: 'from-red-50 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20', border: 'border-red-200/70 dark:border-red-800/50', badge: 'bg-destructive' },
  failed_1: { dot: 'from-orange-400 to-orange-500', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-500' },
  failed_2: { dot: 'from-orange-500 to-orange-600', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-600' },
  failed_3: { dot: 'from-orange-600 to-orange-700', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-700' },
  no_answer: { dot: 'from-gray-400 to-gray-500', bg: 'from-gray-50 to-slate-50/50 dark:from-gray-950/30 dark:to-slate-950/20', border: 'border-gray-200/70 dark:border-gray-800/50', badge: 'bg-gray-500' },
  wrong_number: { dot: 'from-red-400 to-red-500', bg: 'from-red-50 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20', border: 'border-red-200/70 dark:border-red-800/50', badge: 'bg-red-500' },
  postponed: { dot: 'from-fuchsia-400 to-fuchsia-500', bg: 'from-fuchsia-50 to-purple-50/50 dark:from-fuchsia-950/30 dark:to-purple-950/20', border: 'border-fuchsia-200/70 dark:border-fuchsia-800/50', badge: 'bg-fuchsia-500' },
  to_reconfirm: { dot: 'from-fuchsia-400 to-fuchsia-500', bg: 'from-fuchsia-50 to-purple-50/50 dark:from-fuchsia-950/30 dark:to-purple-950/20', border: 'border-fuchsia-200/70 dark:border-fuchsia-800/50', badge: 'bg-fuchsia-500' },
  callback: { dot: 'from-fuchsia-500 to-fuchsia-600', bg: 'from-fuchsia-50 to-purple-50/50 dark:from-fuchsia-950/30 dark:to-purple-950/20', border: 'border-fuchsia-200/70 dark:border-fuchsia-800/50', badge: 'bg-fuchsia-600' },
  duplicate: { dot: 'from-gray-400 to-gray-500', bg: 'from-gray-50 to-slate-50/50 dark:from-gray-950/30 dark:to-slate-950/20', border: 'border-gray-200/70 dark:border-gray-800/50', badge: 'bg-gray-500' },
  out_of_stock: { dot: 'from-red-400 to-red-500', bg: 'from-red-50 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20', border: 'border-red-200/70 dark:border-red-800/50', badge: 'bg-red-500' },
  ready: { dot: 'from-cyan-400 to-cyan-500', bg: 'from-cyan-50 to-sky-50/50 dark:from-cyan-950/30 dark:to-sky-950/20', border: 'border-cyan-200/70 dark:border-cyan-800/50', badge: 'bg-cyan-500' },
  preparing: { dot: 'from-orange-400 to-orange-500', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-500' },
  to_station: { dot: 'from-violet-400 to-violet-500', bg: 'from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20', border: 'border-violet-200/70 dark:border-violet-800/50', badge: 'bg-violet-500' },
  at_station: { dot: 'from-violet-500 to-violet-600', bg: 'from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20', border: 'border-violet-200/70 dark:border-violet-800/50', badge: 'bg-violet-600' },
  au_bureau: { dot: 'from-blue-400 to-blue-500', bg: 'from-blue-50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/20', border: 'border-blue-200/70 dark:border-blue-800/50', badge: 'bg-blue-500' },
  en_livraison: { dot: 'from-amber-400 to-amber-500', bg: 'from-amber-50 to-yellow-50/50 dark:from-amber-950/30 dark:to-yellow-950/20', border: 'border-amber-200/70 dark:border-amber-800/50', badge: 'bg-amber-500' },
  shipped: { dot: 'from-blue-500 to-blue-600', bg: 'from-blue-50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/20', border: 'border-blue-200/70 dark:border-blue-800/50', badge: 'bg-blue-600' },
  delivered: { dot: 'from-green-500 to-green-600', bg: 'from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20', border: 'border-green-200/70 dark:border-green-800/50', badge: 'bg-green-600' },
  delivered_paid: { dot: 'from-emerald-500 to-emerald-600', bg: 'from-emerald-50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/20', border: 'border-emerald-200/70 dark:border-emerald-800/50', badge: 'bg-emerald-600' },
  returned: { dot: 'from-red-500 to-red-600', bg: 'from-red-50 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20', border: 'border-red-200/70 dark:border-red-800/50', badge: 'bg-red-600' },
  erreur: { dot: 'from-red-500 to-red-600', bg: 'from-red-50 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20', border: 'border-red-200/70 dark:border-red-800/50', badge: 'bg-red-600' },
  'Échec_de_livraison': { dot: 'from-red-400 to-red-500', bg: 'from-red-50 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20', border: 'border-red-200/70 dark:border-red-800/50', badge: 'bg-red-500' },
  exchange: { dot: 'from-purple-400 to-purple-500', bg: 'from-purple-50 to-violet-50/50 dark:from-purple-950/30 dark:to-violet-950/20', border: 'border-purple-200/70 dark:border-purple-800/50', badge: 'bg-purple-500' },
  failed_4: { dot: 'from-orange-400 to-orange-500', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-500' },
  failed_5: { dot: 'from-orange-500 to-orange-600', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-500' },
  failed_6: { dot: 'from-orange-600 to-orange-700', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-600' },
  alerte: { dot: 'from-orange-400 to-orange-500', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-orange-500' },
};

const defaultColors = { dot: 'from-blue-400 to-blue-500', bg: 'from-blue-50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/20', border: 'border-blue-200/70 dark:border-blue-800/50', badge: 'bg-blue-500' };

export function StatusHistoryPopover({ order }: StatusHistoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { profileMap, roleMap } = useProfilesAndRoles();

  const historyQueryKey = ['order-history', order.id];
  const historyQueryFn = async () => {
    const { data, error } = await supabase
      .from('order_history')
      .select('new_status, old_status, changed_by, changed_by_user_id, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  };

  const { data: orderHistory, isLoading } = useQuery({
    queryKey: historyQueryKey,
    queryFn: historyQueryFn,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const editHistoryQueryKey = ['order-edit-history', order.id];
  const editHistoryQueryFn = async () => {
    const { data, error } = await (supabase as any)
      .from('order_edit_history')
      .select('id, field, old_value, new_value, label, changed_by, changed_by_user_id, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });
    if (error) {
      // Table may not exist yet if migration hasn't been run — fail silently
      return [];
    }
    return data as Array<{
      id: string;
      field: string;
      old_value: string | null;
      new_value: string | null;
      label: string | null;
      changed_by: string | null;
      changed_by_user_id: string | null;
      created_at: string;
    }>;
  };

  const { data: editHistory } = useQuery({
    queryKey: editHistoryQueryKey,
    queryFn: editHistoryQueryFn,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetch = () => {
    if (prefetchTimer.current) return;
    prefetchTimer.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: historyQueryKey,
        queryFn: historyQueryFn,
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: editHistoryQueryKey,
        queryFn: editHistoryQueryFn,
        staleTime: 5 * 60 * 1000,
      });
      prefetchTimer.current = null;
    }, 150);
  };
  const cancelPrefetch = () => {
    if (prefetchTimer.current) {
      clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
  };

  // Process history entries with shared profile/role data
  const processedHistory = orderHistory?.map(h => {
    let user_name = '';
    let user_role = '';

    const roleLabelMap: Record<string, string> = {
      admin: 'Admin',
      confirmateur: 'Confirmateur',
      stock_manager: 'Stock Manager',
    };

    const deliveryStatuses = ['preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'delivered', 'delivered_paid', 'returned', 'Échec_de_livraison', 'alerte'];
    const rawDeliveryCompany = order.delivery_company || 'Livraison';
    const deliveryCompanyName = rawDeliveryCompany.startsWith('local:')
      ? rawDeliveryCompany.replace('local:', '').trim()
      : rawDeliveryCompany;

    const deliveryCompanyNames = ['ZR Express', 'Sync ZR Express', 'Webhook ZR Express', 'EcoTrack', 'RJ360', 'Maystro'];
    const isDeliveryCompany = h.changed_by && deliveryCompanyNames.some(dc => h.changed_by?.includes(dc));
    const isDeliveryStatusChange = deliveryStatuses.includes(h.new_status);

    if (h.changed_by === 'IA' || (h.changed_by && h.changed_by.startsWith('IA'))) {
      user_name = 'IA';
      user_role = 'ai';
    } else if (h.changed_by && h.changed_by.startsWith('Livreur:')) {
      user_name = h.changed_by.replace('Livreur:', '').trim();
      user_role = 'delivery';
    } else if (isDeliveryCompany) {
      user_name = h.changed_by!.replace('Webhook ', '').replace('Sync ', '');
      user_role = 'delivery';
    } else if ((h.changed_by === 'Système' || !h.changed_by) && !h.changed_by_user_id && isDeliveryStatusChange) {
      user_name = deliveryCompanyName;
      user_role = 'delivery';
    } else if ((h.changed_by === 'Système' || !h.changed_by) && !h.changed_by_user_id) {
      user_name = 'Système';
      user_role = 'delivery';
    } else if (h.changed_by_user_id) {
      user_name = profileMap[h.changed_by_user_id] || h.changed_by || 'Utilisateur';
      user_role = roleMap[h.changed_by_user_id] || 'user';
    } else if (h.changed_by) {
      user_name = h.changed_by;
      user_role = 'user';
    }

    return { ...h, user_name, user_role };
  });

  const historyCount = processedHistory?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-[10px] h-7 px-2 text-muted-foreground hover:text-foreground"
          onMouseEnter={prefetch}
          onMouseLeave={cancelPrefetch}
          onFocus={prefetch}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-xl shadow-xl border-border/50 overflow-hidden" side="left" align="center">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-accent/5 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
            <History className="h-3.5 w-3.5 text-primary" />
          </div>
          <h4 className="font-semibold text-sm tracking-tight">Historique Statut</h4>
          {historyCount > 0 && (
            <span className="ml-auto text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{historyCount}</span>
          )}
        </div>

        <div className="px-3 py-3 max-h-[320px] overflow-y-auto">
          <div className="relative flex flex-col gap-0">
            {isLoading && historyCount === 0 ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : historyCount === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">Aucun changement de statut</div>
            ) : (
              processedHistory?.map((h, idx) => {
                const c = statusColorMap[h.new_status] || defaultColors;
                const newLabel = statusLabels[h.new_status] || h.new_status;
                const newTransitionLabel = transitionLabels[h.new_status] || newLabel;
                const oldTransitionLabel = h.old_status ? (transitionLabels[h.old_status] || statusLabels[h.old_status] || h.old_status) : null;
                const text = oldTransitionLabel ? `${oldTransitionLabel} → ${newTransitionLabel}` : `Statut: ${newTransitionLabel}`;
                const isLast = idx === (processedHistory?.length || 0) - 1;
                const date = new Date(h.created_at);
                const ts = `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

                return (
                  <div key={idx} className={`relative flex gap-3 ${isLast ? 'pb-1' : 'pb-3'}`}>
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full bg-gradient-to-b ${c.dot} shadow-sm ring-2 ring-white dark:ring-gray-900 shrink-0 mt-1`} />
                      {!isLast && <div className="w-0.5 flex-1 bg-border/60 mt-1" />}
                    </div>
                    <div className={`flex-1 bg-gradient-to-br ${c.bg} rounded-xl p-2.5 border ${c.border} shadow-sm mb-0.5`}>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Badge className={`${c.badge} text-white text-[10px] px-2 py-0.5 h-fit shadow-sm shrink-0`}>{newLabel}</Badge>
                          <span className="text-[10px] text-muted-foreground font-medium ml-auto shrink-0">{ts}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full min-w-0">
                          {h.user_name && (
                            <span className="text-[10px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0 whitespace-nowrap">
                              {h.user_role === 'ai' ? <Bot className="h-2.5 w-2.5 shrink-0" /> 
                                : h.user_role === 'delivery' ? <Truck className="h-2.5 w-2.5 shrink-0" />
                                : h.user_role === 'admin' ? <Shield className="h-2.5 w-2.5 shrink-0" />
                                : <User className="h-2.5 w-2.5 shrink-0" />}
                              {h.user_role === 'ai' ? 'IA' : h.user_role === 'delivery' && h.changed_by?.startsWith('Livreur:') ? `Livreur : ${h.user_name}` : h.user_name}
                            </span>
                          )}
                          <span className="text-xs font-medium truncate min-w-0 flex-1 text-center">{text}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
