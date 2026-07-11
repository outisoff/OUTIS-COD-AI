import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MapPin, Clock, ChevronDown, CheckCircle2, Truck, AlertTriangle, XCircle, Building2, PackageCheck, RotateCcw, Phone, MessageSquare, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

function getSituationStyle(text: string | null): { bg: string; tc: string; border: string; Icon: LucideIcon } {
  if (!text) return { bg: 'bg-muted/40', tc: 'text-muted-foreground', border: 'border-border', Icon: Clock };
  const t = text.toLowerCase();
  if (t.includes('sortir en livraison') || t.includes('sortie en livraison') || t.includes('en cours') || t.includes('transit') || t.includes('dispatch')) return { bg: 'bg-primary/10', tc: 'text-primary', border: 'border-primary/25', Icon: Truck };
  if (t.includes('livr') || t.includes('deliver') || t.includes('encaiss') || t.includes('recouvert')) return { bg: 'bg-success/10', tc: 'text-success', border: 'border-success/25', Icon: CheckCircle2 };
  if (t.includes('en livraison')) return { bg: 'bg-primary/10', tc: 'text-primary', border: 'border-primary/25', Icon: Truck };
  if (t.includes('bureau') || t.includes('station') || t.includes('hub')) return { bg: 'bg-primary/10', tc: 'text-primary', border: 'border-primary/25', Icon: Building2 };
  if (t.includes('confirm') || t.includes('ramass') || t.includes('pickup')) return { bg: 'bg-chart-5/10', tc: 'text-chart-5', border: 'border-chart-5/25', Icon: PackageCheck };
  if (t.includes('échec') || t.includes('echou') || t.includes('fail') || t.includes('erron')) return { bg: 'bg-destructive/10', tc: 'text-destructive', border: 'border-destructive/25', Icon: XCircle };
  if (t.includes('retour') || t.includes('return')) return { bg: 'bg-destructive/10', tc: 'text-destructive', border: 'border-destructive/25', Icon: RotateCcw };
  if (t.includes('annul')) return { bg: 'bg-destructive/10', tc: 'text-destructive', border: 'border-destructive/25', Icon: XCircle };
  if (t.includes('répond') || t.includes('repond')) return { bg: 'bg-destructive/10', tc: 'text-destructive', border: 'border-destructive/25', Icon: AlertTriangle };
  if (t.includes('report') || t.includes('réport') || t.includes('attent') || t.includes('alert')) return { bg: 'bg-warning/10', tc: 'text-warning', border: 'border-warning/25', Icon: AlertTriangle };
  if (t.includes('appel') || t.includes('téléph') || t.includes('teleph') || t.includes('phone') || t.includes('rappel')) return { bg: 'bg-chart-5/10', tc: 'text-chart-5', border: 'border-chart-5/25', Icon: Phone };
  if (t.includes('sms') || t.includes('message')) return { bg: 'bg-chart-5/10', tc: 'text-chart-5', border: 'border-chart-5/25', Icon: MessageSquare };
  return { bg: 'bg-accent', tc: 'text-accent-foreground', border: 'border-border', Icon: Truck };
}

interface HistoryEntry {
  createdAt: string;
  newState: {
    description: string;
    name: string;
    color: string;
  };
  previousState?: {
    description: string;
    name: string;
  };
  location?: {
    hubName: string;
    hubCity: string;
    type: string;
  };
  situations?: Array<{
    createdAt: string;
    situationDescription: string;
    situationName: string;
    metadata?: { comment?: string };
  }>;
  comment?: string;
}

interface TrackingHistoryPopoverProps {
  trackingNumber: string;
  currentSituation: string | null;
  lastUpdate: string | null;
  deliveryStatus?: string | null;
}

export function TrackingHistoryPopover({ trackingNumber, currentSituation, lastUpdate, deliveryStatus }: TrackingHistoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = async () => {
    const { data } = await supabase.functions.invoke('zr-express-tracking-history', {
      body: { tracking_number: trackingNumber },
    });
    return (data?.history ?? []) as HistoryEntry[];
  };

  const { data: history = [], isLoading: loading } = useQuery({
    queryKey: ['tracking-history', trackingNumber],
    queryFn: fetchHistory,
    enabled: open && !!trackingNumber,
    staleTime: 60_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const prefetch = () => {
    if (!trackingNumber || prefetchTimer.current) return;
    prefetchTimer.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ['tracking-history', trackingNumber],
        queryFn: fetchHistory,
        staleTime: 60_000,
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

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onMouseEnter={prefetch} onMouseLeave={cancelPrefetch} className="flex items-center justify-center cursor-pointer group w-full">
          {(() => {
            const label = currentSituation || deliveryStatus;
            if (label) {
              const s = getSituationStyle(label);
              const SIcon = s.Icon;
              return (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${s.bg} border ${s.border} group-hover:shadow-sm transition-all max-w-[155px]`}>
                  <SIcon className={`h-3.5 w-3.5 ${s.tc} shrink-0`} />
                  <span className={`text-[11px] font-semibold ${s.tc} leading-tight text-center truncate`}>
                    {label}
                  </span>
                  <ChevronDown className={`h-2.5 w-2.5 ${s.tc} opacity-40 shrink-0`} />
                </div>
              );
            }
            return (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">
                <Clock className="h-3 w-3" />
                <ChevronDown className="h-2.5 w-2.5" />
              </div>
            );
          })()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0 max-h-[500px] flex flex-col" align="center" side="left">
        <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
          <h4 className="font-semibold text-sm">Historique de suivi</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">{trackingNumber}</p>
        </div>
        <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: '420px' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Aucun historique</div>
          ) : (
            <div className="py-2">
              {[...history].reverse().map((entry, idx) => (
                <div key={idx} className="relative">
                  {/* State entry */}
                  <div className="flex gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
                        style={{
                          borderColor: `#${entry.newState.color}`,
                          backgroundColor: idx === history.length - 1 ? `#${entry.newState.color}` : 'transparent',
                        }}
                      />
                      {idx < history.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md text-white"
                          style={{ backgroundColor: `#${entry.newState.color}` }}
                        >
                          {entry.newState.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.createdAt)}
                        </span>
                        {entry.location && (
                          <span className="flex items-center gap-1 text-primary">
                            <MapPin className="h-3 w-3" />
                            {entry.location.hubName}
                          </span>
                        )}
                      </div>
                      {entry.comment && entry.comment !== '' && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">{entry.comment}</p>
                      )}
                      {/* Situations within this state */}
                      {entry.situations && entry.situations.length > 0 && (
                        <div className="mt-1.5 space-y-1 ml-2 border-l-2 border-amber-200 pl-2">
                          {entry.situations.map((sit, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    {sit.situationDescription}
                                  </span>
                                </div>
                                <span className="text-[9px] text-muted-foreground">
                                  {formatTime(sit.createdAt)}
                                  {sit.metadata?.comment && ` — ${sit.metadata.comment}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
