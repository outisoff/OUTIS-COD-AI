import { useState, useMemo } from 'react';
import { Building2, MapPin, Navigation, Hash, Loader2, Phone, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { usePickupPoints } from '@/hooks/usePickupPoints';

interface StopDeskInfo {
  id: string;
  name: string;
  address: string;
  city: string;
  commune: string;
  type: string;
  phone: string | Record<string, string> | null;
  latitude: number | null;
  longitude: number | null;
}

interface StopDeskInfoPopoverProps {
  order: {
    delivery_type: string;
    delivery_company: string | null;
    customer_address: string;
    wilaya: string;
  };
  children: React.ReactNode;
}

function parseStopDeskFromAddress(address: string): { name: string; commune: string; addr: string } | null {
  const match = address.match(/^Stop Desk:\s*(.+?)\s*—\s*(.+?)(?:,\s*(.+))?$/);
  if (!match) return null;
  return {
    name: match[1]?.trim() || '',
    commune: match[2]?.trim() || '',
    addr: match[3]?.trim() || '',
  };
}

export function StopDeskInfoPopover({ order, children }: StopDeskInfoPopoverProps) {
  const [open, setOpen] = useState(false);

  const isStopDesk = order.delivery_type === 'stop_desk' && !!order.delivery_company;
  const isZR = order.delivery_company?.toLowerCase().includes('zr') ?? false;
  const parsed = parseStopDeskFromAddress(order.customer_address);
  const wilayaName = order.wilaya.split(' - ')[1]?.trim() || order.wilaya;

  // Use React Query hook — results are cached globally by wilaya+company
  const { data: pickupPoints = [], isLoading: loading } = usePickupPoints(
    wilayaName,
    order.delivery_company || '',
    open && isZR
  );

  const info = useMemo(() => {
    if (!pickupPoints.length) return null;
    const points = pickupPoints as StopDeskInfo[];
    if (parsed) {
      const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = norm(parsed.name);
      // 1) exact name match
      let match = points.find(p => p.name === parsed.name);
      // 2) normalized exact name match (ignore accents/spaces/arabic)
      if (!match) match = points.find(p => norm(p.name) === target);
      // 3) normalized partial name match (latin part only, e.g. "hubbellevue25")
      if (!match && target) {
        const latinTarget = target.replace(/[^a-z0-9]/g, '');
        match = points.find(p => {
          const n = norm(p.name);
          return n.includes(latinTarget) || latinTarget.includes(n);
        });
      }
      // 4) try matching the latin words (e.g. "belle vue 25") against hub names
      if (!match) {
        const latinOnly = parsed.name.replace(/[^\x00-\x7F]/g, '').trim();
        const latinNorm = norm(latinOnly);
        if (latinNorm.length >= 3) {
          match = points.find(p => norm(p.name).includes(latinNorm) || latinNorm.includes(norm(p.name)));
        }
      }
      return match || null; // do NOT fallback to first commune hub — it would be misleading
    }
    return points[0] || null;
  }, [pickupPoints, parsed]);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
  };

  const displayInfo: StopDeskInfo | null = info || (parsed ? {
    id: '',
    name: parsed.name,
    address: parsed.addr,
    city: order.wilaya.split(' - ')[1]?.trim() || '',
    commune: parsed.commune,
    type: '',
    phone: '',
    latitude: null,
    longitude: null,
  } : null);

  const mapsUrl = displayInfo?.latitude && displayInfo?.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${displayInfo.latitude},${displayInfo.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [displayInfo?.name, displayInfo?.commune, displayInfo?.city, displayInfo?.address].filter(Boolean).join(', ')
      )}`;

  if (!isStopDesk) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span className="cursor-pointer">{children}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[9999]" align="center">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-md border-b bg-primary/5 border-primary/20">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-primary text-sm">Informations Stop Desk</span>
          {order.delivery_company && (
            <Badge variant="outline" className="ml-auto text-[10px] bg-yellow-100 text-yellow-700 border-yellow-300 font-medium">
              {order.delivery_company}
            </Badge>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : displayInfo ? (
            <div className="space-y-3">
              {/* Name */}
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Nom du bureau</p>
                  <p className="text-sm font-semibold text-foreground leading-tight">{displayInfo.name}</p>
                </div>
              </div>

              {/* City / Commune */}
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Localisation</p>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                    >
                      {displayInfo.commune && <span>{displayInfo.commune}</span>}
                      {displayInfo.city && displayInfo.commune && <span className="text-muted-foreground"> — </span>}
                      {displayInfo.city && <span>{displayInfo.city}</span>}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(mapsUrl);
                        toast.success('Lien copié !');
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                      title="Copier le lien"
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Address */}
              {displayInfo.address && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Navigation className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Adresse</p>
                    <p className="text-sm text-foreground">{displayInfo.address}</p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {displayInfo.phone && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-6 w-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Phone className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Téléphone</p>
                    <p className="text-sm font-medium text-foreground">
                      {typeof displayInfo.phone === 'string' 
                        ? displayInfo.phone 
                        : typeof displayInfo.phone === 'object' && displayInfo.phone !== null
                          ? Object.values(displayInfo.phone as Record<string, string>).filter(Boolean).join(' / ')
                          : String(displayInfo.phone)}
                    </p>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune information disponible</p>
              {parsed?.name && (
                <p className="text-xs mt-1 font-medium text-foreground">{parsed.name}</p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
