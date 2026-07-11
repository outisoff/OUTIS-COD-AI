import { useState } from 'react';
import { Plus, MessageCircle, Package, User, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { OrderWithItems } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';

interface SuiviPopoverProps {
  order: OrderWithItems;
}

// ZR Express status labels in French
const ZR_STATUS_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  'cree': { label: 'Créé', emoji: '🆕', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  'pret_a_expedier': { label: 'Prêt à expédier', emoji: '📦', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  'pris_en_charge': { label: 'Pris en charge', emoji: '🔵', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  'vers_wilaya': { label: 'Vers wilaya', emoji: '🚚', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  'transfere': { label: 'Transféré', emoji: '🔄', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  'recu_au_hub': { label: 'Reçu au hub', emoji: '📍', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  'confirme_au_bureau': { label: 'Confirmé au bureau', emoji: '🟣', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  'confirmee_au_bureau': { label: 'Confirmée au bureau', emoji: '🟣', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  'au_bureau': { label: 'Au bureau', emoji: '🟣', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  'dispatch_dans_une_autre_wilaya': { label: 'Dispatch autre wilaya', emoji: '🔄', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  'dispatch_dans_la_meme_wilaya': { label: 'Dispatch même wilaya', emoji: '🔄', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  'sorti_en_livraison': { label: 'Sorti en livraison', emoji: '🟠', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  'sortie_en_livraison': { label: 'Sortie en livraison', emoji: '🟠', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  'en_cours_de_livraison': { label: 'En cours de livraison', emoji: '🟠', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  'expedie': { label: 'Expédié', emoji: '🔵', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  'livre': { label: 'Livré', emoji: '🟢', color: 'bg-green-100 text-green-700 border-green-300' },
  'tentative_echouee': { label: 'Tentative échouée', emoji: '🟡', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  'echec_de_livraison': { label: 'Échec de livraison', emoji: '🔴', color: 'bg-red-100 text-red-700 border-red-300' },
  'retourne': { label: 'Retourné', emoji: '↩️', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  'retour_vers_centre': { label: 'Retour vers centre', emoji: '↩️', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  'retour_recu': { label: 'Retour reçu', emoji: '↩️', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  'perdu': { label: 'Perdu', emoji: '⚫', color: 'bg-gray-800 text-white border-gray-900' },
};

function getZrStatusInfo(rawStatus: string) {
  // Try exact match first (normalized to lowercase with underscores)
  const normalized = rawStatus.toLowerCase().replace(/[\s'é]+/g, (match) => {
    if (match === ' ') return '_';
    if (match === "'") return '_';
    return match;
  }).replace(/\s+/g, '_');
  
  if (ZR_STATUS_LABELS[normalized]) return ZR_STATUS_LABELS[normalized];
  
  // Try matching by checking if any key is contained
  for (const [key, value] of Object.entries(ZR_STATUS_LABELS)) {
    if (normalized.includes(key) || key.includes(normalized)) return value;
  }
  
  // Fallback: show raw status
  return { label: rawStatus, emoji: '📋', color: 'bg-muted text-muted-foreground border-border' };
}

export function SuiviPopover({ order }: SuiviPopoverProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [remarkInput, setRemarkInput] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);

  // Fetch delivery status from deliveries table
  const { data: deliveryData } = useQuery({
    queryKey: ['delivery-status', order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deliveries')
        .select('delivery_status, delivery_situation, last_update')
        .eq('order_id', order.id)
        .maybeSingle();
      return data;
    },
    enabled: order.delivery_company === 'ZR Express' && !!order.tracking_number,
  });

  const getUserName = () => {
    if (!user) return 'Utilisateur';
    const metadata = user.user_metadata as { full_name?: string } | null;
    return metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur';
  };

  const handleAddRemark = async () => {
    const remark = remarkInput.trim();
    if (!remark) return;
    
    setSavingRemark(true);
    try {
      const currentNotes = order.notes || '';
      const timestamp = new Date().toLocaleString('fr-FR', { 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit' 
      });
      const userName = getUserName();
      const newNotes = currentNotes 
        ? `${currentNotes}\n[${timestamp}][${userName}] ${remark}`
        : `[${timestamp}][${userName}] ${remark}`;
      
      const { error } = await supabase
        .from('orders')
        .update({ notes: newNotes })
        .eq('id', order.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      setRemarkInput('');
      toast({ title: 'Remarque ajoutée', description: 'La remarque a été enregistrée.' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter la remarque.', variant: 'destructive' });
    } finally {
      setSavingRemark(false);
    }
  };

  const noteLines = order.notes?.split('\n').filter(line => line.trim()) || [];
  const noteCount = noteLines.length;
  
  const getLatestRemarkInfo = () => {
    if (noteLines.length === 0) return null;
    const latestLine = noteLines[noteLines.length - 1];
    const matchWithUser = latestLine.match(/^\[(.+?)\]\[(.+?)\]\s*(.+)$/);
    const matchLegacy = latestLine.match(/^\[(.+?)\]\s*(.+)$/);
    
    if (matchWithUser) return { timestamp: matchWithUser[1], user: matchWithUser[2], text: matchWithUser[3] };
    if (matchLegacy) return { timestamp: matchLegacy[1], user: null, text: matchLegacy[2] };
    return { timestamp: null, user: null, text: latestLine };
  };
  
  const latestRemark = getLatestRemarkInfo();
  const isZR = order.delivery_company === 'ZR Express' && !!order.tracking_number;
  const zrStatus = deliveryData?.delivery_status ? getZrStatusInfo(deliveryData.delivery_status) : null;
  const zrSituation = (deliveryData as any)?.delivery_situation as string | null;

  return (
    <div className="flex flex-col gap-1.5 items-center">
      {/* Show latest remark card */}
      {latestRemark ? (
        <div className="bg-accent/50 rounded-md px-2 py-1.5 border border-border/50 max-w-[180px] animate-fade-in">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MessageCircle className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] text-muted-foreground">Remarque</span>
          </div>
          <p className="text-xs font-medium truncate" title={latestRemark.text}>
            {latestRemark.text}
          </p>
        </div>
      ) : null}
      
      {/* Voir button with popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant={noteCount > 0 ? "secondary" : "outline"} 
            size="sm" 
            className="gap-1.5 text-xs w-fit hover-scale"
          >
            {noteCount > 0 ? <MessageCircle className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {noteCount > 0 ? `Voir (${noteCount})` : 'Ajouter'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 rounded-xl shadow-xl border-border/50 overflow-hidden" side="left" align="center">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-accent/5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
              <Package className="h-3.5 w-3.5 text-primary" />
            </div>
            <h4 className="font-semibold text-sm tracking-tight">Remarque</h4>
            {noteCount > 0 && (
              <span className="ml-auto text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{noteCount}</span>
            )}
          </div>

          {/* Timeline */}
          <div className="px-3 py-3 max-h-[320px] overflow-y-auto">
            <div className="relative flex flex-col gap-0">
              {(() => {
                const entries: { date: Date; user?: string | null; text?: string }[] = [];
                noteLines.forEach((line) => {
                  const matchWithUser = line.match(/^\[(.+?)\]\[(.+?)\]\s*(.+)$/);
                  const matchLegacy = line.match(/^\[(.+?)\]\s*(.+)$/);
                  if (matchWithUser) {
                    const parts = matchWithUser[1].split(/[\s\/,:]+/);
                    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${parts[3]}:${parts[4]}:00`);
                    entries.push({ date: isNaN(d.getTime()) ? new Date(0) : d, user: matchWithUser[2], text: matchWithUser[3] });
                  } else if (matchLegacy) {
                    const parts = matchLegacy[1].split(/[\s\/,:]+/);
                    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${parts[3]}:${parts[4]}:00`);
                    entries.push({ date: isNaN(d.getTime()) ? new Date(0) : d, user: null, text: matchLegacy[2] });
                  } else {
                    entries.push({ date: new Date(0), user: null, text: line });
                  }
                });
                entries.sort((a, b) => b.date.getTime() - a.date.getTime());
                if (entries.length === 0) {
                  return <div className="text-xs text-muted-foreground text-center py-6">Aucune remarque</div>;
                }
                const c = { dot: 'from-orange-400 to-orange-500', ring: 'ring-orange-200 dark:ring-orange-800', line: 'from-orange-300/60', bg: 'from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20', border: 'border-orange-200/70 dark:border-orange-800/50', badge: 'bg-gradient-to-b from-orange-400 to-orange-500' };
                return entries.map((entry, idx) => {
                  const isLast = idx === entries.length - 1;
                  const ts = entry.date.getTime() > 0
                    ? `${entry.date.toLocaleDateString('fr-FR')} ${entry.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                    : null;
                  return (
                    <div key={idx} className={`relative flex gap-3 ${isLast ? 'pb-1' : 'pb-3'}`}>
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full bg-gradient-to-b ${c.dot} shadow-sm ring-2 ${c.ring} shrink-0 mt-1`} />
                        {!isLast && <div className={`w-0.5 flex-1 bg-gradient-to-b ${c.line} to-border/40 mt-1`} />}
                      </div>
                      <div className={`flex-1 bg-gradient-to-br ${c.bg} rounded-xl p-2.5 border ${c.border} shadow-sm transition-all hover:shadow-md mb-0.5`}>
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <Badge className={`${c.badge} text-white text-[10px] px-2 py-0.5 h-fit shadow-sm`}>Remarque</Badge>
                            {entry.user && (
                              <span className="text-[10px] font-semibold flex items-center gap-0.5 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                <User className="h-2.5 w-2.5" />
                                {entry.user}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {ts && <span className="text-[10px] text-muted-foreground font-medium">{ts}</span>}
                            <div className="text-xs mt-0.5 font-medium">{entry.text}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Input area */}
          <div className="p-3 border-t bg-gradient-to-r from-muted/30 to-transparent space-y-2">
            <Textarea
              placeholder="Ajouter une remarque..."
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              className="text-xs min-h-[60px] resize-none rounded-lg border-border/60 focus:border-primary/40 transition-colors"
            />
            <Button 
              size="sm" 
              variant="outline"
              className="w-full gap-1.5 text-xs rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
              onClick={handleAddRemark}
              disabled={!remarkInput.trim() || savingRemark}
            >
              <Plus className="h-3 w-3" />
              {savingRemark ? 'Enregistrement...' : 'Ajouter'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
