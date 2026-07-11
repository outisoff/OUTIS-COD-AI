import { useEffect, useRef, useState, useCallback } from 'react';
import { Map } from 'react-algeria-map';
import { MapPin, ShoppingCart, CheckCircle, PackageCheck, Ban, AlertTriangle, Inbox } from 'lucide-react';
import type { MapFilterStatus } from '@/hooks/useOrdersByWilaya';

const NAME_TO_MAP: Record<string, string> = {
  "El M'Ghair": "El Meghaier",
  "El Meniaa": "El Menia",
};

const getMapName = (name: string) => NAME_TO_MAP[name] || name;

const COLOR_SCALE = [
  { min: 0, max: 0, color: 'hsl(var(--muted))' },
  { min: 1, max: 19, color: 'hsl(217, 60%, 78%)' },
  { min: 20, max: 99, color: 'hsl(217, 68%, 64%)' },
  { min: 100, max: 199, color: 'hsl(217, 78%, 52%)' },
  { min: 200, max: 299, color: 'hsl(217, 85%, 42%)' },
  { min: 300, max: Infinity, color: 'hsl(217, 91%, 32%)' },
];

const LEGEND_ITEMS = [
  { label: '0', color: 'hsl(var(--muted))' },
  { label: '1-19', color: 'hsl(217, 60%, 78%)' },
  { label: '20-99', color: 'hsl(217, 68%, 64%)' },
  { label: '100+', color: 'hsl(217, 78%, 52%)' },
  { label: '200+', color: 'hsl(217, 85%, 42%)' },
  { label: '300+', color: 'hsl(217, 91%, 32%)' },
];

function getColor(count: number): string {
  for (const scale of COLOR_SCALE) {
    if (count >= scale.min && count <= scale.max) return scale.color;
  }
  return COLOR_SCALE[COLOR_SCALE.length - 1].color;
}

const FILTER_OPTIONS: { key: MapFilterStatus; label: string; icon: typeof ShoppingCart; color: string; activeBg: string }[] = [
  { key: 'total', label: 'Total', icon: ShoppingCart, color: 'text-primary', activeBg: 'bg-primary text-primary-foreground' },
  { key: 'received', label: 'Reçues', icon: Inbox, color: 'text-blue-600', activeBg: 'bg-blue-600 text-white' },
  { key: 'cancelled', label: 'Annulées', icon: Ban, color: 'text-red-500', activeBg: 'bg-red-500 text-white' },
  { key: 'delivered', label: 'Livré', icon: PackageCheck, color: 'text-emerald-600', activeBg: 'bg-emerald-600 text-white' },
  { key: 'returned', label: 'Retour', icon: AlertTriangle, color: 'text-red-700', activeBg: 'bg-red-700 text-white' },
];

interface AlgeriaOrdersMapProps {
  wilayaCounts: Record<string, number>;
  filterStatus: MapFilterStatus;
  onFilterChange: (status: MapFilterStatus) => void;
}

export function AlgeriaOrdersMap({ wilayaCounts, filterStatus, onFilterChange }: AlgeriaOrdersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredWilaya, setHoveredWilaya] = useState<{ name: string; count: number } | null>(null);
  

  const mapData: Record<string, number> = {};
  Object.entries(wilayaCounts).forEach(([name, count]) => {
    mapData[getMapName(name)] = count;
  });

  const listenersRef = useRef<Array<{ el: Element; type: string; handler: EventListener }>>([]);

  const applyColors = useCallback(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    // Cleanup previous listeners
    listenersRef.current.forEach(({ el, type, handler }) => el.removeEventListener(type, handler));
    listenersRef.current = [];

    // Find all path/polygon elements with class 'state'
    const stateElements = svg.querySelectorAll('.state');
    
    stateElements.forEach(path => {
      const g = path.closest('g') || path.parentElement;
      if (!g) return;
      const id = path.id || '';

      // Extract wilaya name - try multiple ID patterns
      let mapWilayaName = '';
      
      // Pattern 1: _x3X_NN_Name (most common)
      const match1 = id.match(/^_x3\d_\d+_(.+)$/);
      // Pattern 2: _x3X_Name (without number)
      const match2 = id.match(/^_x3\d_(.+)$/);
      // Pattern 3: NN_Name
      const match3 = id.match(/^\d+_(.+)$/);
      // Pattern 4: _Name
      const match4 = id.match(/^_(.+)$/);
      
      if (match1) {
        mapWilayaName = match1[1];
      } else if (match2) {
        mapWilayaName = match2[1];
      } else if (match3) {
        mapWilayaName = match3[1];
      } else if (match4) {
        mapWilayaName = match4[1];
      } else if (id) {
        mapWilayaName = id;
      } else {
        // Fallback: check parent g for an id or text
        const parentId = g.id || '';
        const titleEl = g.querySelector('title');
        const textEl = g.querySelector('text');
        mapWilayaName = parentId || titleEl?.textContent || textEl?.textContent || '';
      }

      if (!mapWilayaName) return;

      mapWilayaName = mapWilayaName
        .replace(/_x27_/g, "'")
        .replace(/_1_$/, '')
        .replace(/_/g, ' ')
        .trim();

      let count = mapData[mapWilayaName] || 0;
      if (count === 0) {
        const originalName = Object.keys(NAME_TO_MAP).find(k => NAME_TO_MAP[k] === mapWilayaName);
        if (originalName) count = wilayaCounts[originalName] || 0;
      }
      if (count === 0) count = wilayaCounts[mapWilayaName] || 0;

      path.setAttribute('fill', getColor(count));
      path.setAttribute('style', 'cursor: pointer; pointer-events: all; transition: opacity 0.25s ease, filter 0.25s ease;');

      const handleMouseEnter = () => {
        path.setAttribute('opacity', '0.75');
        path.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))');
        setHoveredWilaya({ name: mapWilayaName, count });
      };
      const handleMouseLeave = () => {
        path.setAttribute('opacity', '1');
        path.setAttribute('filter', 'none');
        setHoveredWilaya(null);
      };
      const handleClick = () => {};

      path.addEventListener('mouseenter', handleMouseEnter);
      path.addEventListener('mouseleave', handleMouseLeave);
      path.addEventListener('click', handleClick);
      listenersRef.current.push({ el: path, type: 'mouseenter', handler: handleMouseEnter });
      listenersRef.current.push({ el: path, type: 'mouseleave', handler: handleMouseLeave });
      listenersRef.current.push({ el: path, type: 'click', handler: handleClick });
    });
  }, [wilayaCounts, mapData]);


  useEffect(() => {
    const timer = setTimeout(applyColors, 150);
    return () => {
      clearTimeout(timer);
      listenersRef.current.forEach(({ el, type, handler }) => el.removeEventListener(type, handler));
      listenersRef.current = [];
    };
  }, [applyColors]);

  const totalOrders = Object.values(wilayaCounts).reduce((sum, c) => sum + c, 0);
  const totalWilayas = Object.keys(wilayaCounts).filter(k => wilayaCounts[k] > 0).length;

  const top10Wilayas = Object.entries(wilayaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const maxCount = top10Wilayas.length > 0 ? top10Wilayas[0][1] : 1;
  const activeFilter = FILTER_OPTIONS.find(f => f.key === filterStatus)!;
  const activeWilaya = hoveredWilaya;

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <h3 className="text-base font-semibold">Répartition géographique :</h3>
        <p className="text-xs text-muted-foreground">{totalWilayas} wilayas actives</p>
      </div>

      {/* Filter Tabs */}
      <div className="relative z-20 px-6 pb-3 pt-1 pointer-events-none">
        <div className="inline-flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/40 pointer-events-auto">
          {FILTER_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = filterStatus === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onFilterChange(opt.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                  isActive
                    ? `${opt.activeBg} shadow-md`
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                }`}
              >
                <Icon className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-4">
        <div className="flex gap-4 items-end">
          {/* Top 10 Wilayas - BOTTOM LEFT */}
          <div className="w-44 shrink-0 -translate-y-12">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1.5">
              Top 10 Wilayas
            </p>
            <div className="space-y-0">
              {Array.from({ length: 10 }).map((_, i) => {
                const entry = top10Wilayas[i];
                const name = entry?.[0] ?? '';
                const count = entry?.[1] ?? 0;
                return (
                  <div
                    key={i}
                    className="group flex items-center gap-2 py-0.5 px-1.5 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-default border-b border-border/20 last:border-b-0 h-[26px]"
                  >
                    <span className={`text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-md ${
                      i === 0 ? 'bg-primary text-primary-foreground shadow-sm' :
                      i === 1 ? 'bg-primary/20 text-primary' :
                      i === 2 ? 'bg-primary/10 text-primary' :
                      'text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate group-hover:text-primary transition-colors">
                        {name ? name.replace(/^\d+\s*-\s*/, '') : <span className="text-muted-foreground/40">—</span>}
                      </p>
                      <div className="w-full bg-muted/80 rounded-full h-[2px] mt-0.5">
                        <div
                          className="h-full rounded-full bg-primary/50 transition-all duration-500"
                          style={{ width: count > 0 ? `${Math.max((count / maxCount) * 100, 6)}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-extrabold tabular-nums text-foreground">
                      {count > 0 ? count : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map - right, vertically centered */}
          <div ref={containerRef} className="relative z-0 flex-1 min-w-0 self-start -mt-12 translate-x-6" onMouseLeave={() => setHoveredWilaya(null)}>
            <Map
              color="hsl(217, 50%, 55%)"
              HoverColor="hsl(217, 60%, 45%)"
              stroke="hsl(var(--background))"
              hoverStroke="hsl(var(--background))"
              height="400px"
              width="100%"
              data={mapData}
              onWilayaClick={() => {}}
            />

            {activeWilaya && (
              <div className="absolute -top-8 right-4 pointer-events-none z-10 animate-scale-in">
                <div className="bg-card border border-border rounded-2xl px-5 py-3.5 shadow-lg flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{activeWilaya.name}</p>
                    <p className="text-sm text-primary font-semibold mt-0.5">
                      {activeWilaya.count} commande{activeWilaya.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
