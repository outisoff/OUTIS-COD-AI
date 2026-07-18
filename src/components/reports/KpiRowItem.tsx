import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from './KpiCardRich';

interface Props {
  icon?: LucideIcon;
  label: string;
  value: string;
  rawValue: number;
  previousValue: number;
  formatValue: (v: number) => string;
  tone?: Tone;
  invertTrend?: boolean;
  showDelta?: boolean; // show small +/-% pill next to value (used for Bénéfices, Upsell etc.)
  suffix?: string; // e.g. "(DZD)" greyed
  onClick?: () => void;
  /** Optional secondary line below the label (e.g. "X DZD / Livré") */
  secondaryLabel?: string;
  secondaryValue?: string;
}

function formatDelta(current: number, previous: number): { pct: number | null; abs: number } {
  const abs = current - previous;
  if (previous === 0) return { pct: current === 0 ? 0 : null, abs };
  const pct = (abs / Math.abs(previous)) * 100;
  return { pct: Math.round(pct * 10) / 10, abs };
}

export function KpiRowItem({
  icon: Icon, label, value, rawValue, previousValue, tone, invertTrend, showDelta, suffix, onClick,
  secondaryLabel, secondaryValue,
}: Props) {
  const { pct, abs } = formatDelta(rawValue, previousValue);
  const positive = invertTrend ? abs < 0 : abs > 0;
  const TrendIcon = abs === 0 ? Minus : positive ? TrendingUp : TrendingDown;
  const trendColor = abs === 0 ? 'text-muted-foreground' : positive ? 'text-success' : 'text-destructive';
  const trendBg = abs === 0 ? 'bg-muted' : positive ? 'bg-success/10' : 'bg-destructive/10';

  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={cn(
        'group flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-muted/40 transition-colors',
        'hover:bg-muted/70',
        isClickable && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={cn(
            'flex items-center justify-center h-8 w-8 rounded-md shrink-0',
            tone === 'success' && 'bg-success/10 text-success',
            tone === 'warning' && 'bg-warning/10 text-warning',
            tone === 'destructive' && 'bg-destructive/10 text-destructive',
            tone === 'primary' && 'bg-primary/10 text-primary',
            !tone && 'bg-muted text-muted-foreground',
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          {secondaryLabel && (
            <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
              <span className="tabular-nums font-semibold text-foreground/70">{secondaryValue}</span>
              <span className="ml-1">{secondaryLabel}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
        {suffix && <span className="text-[11px] text-muted-foreground/70">{suffix}</span>}
        {showDelta && (
          <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold', trendBg, trendColor)}>
            <TrendIcon className="h-2.5 w-2.5" />
            {pct === null ? 'N/A' : `${pct > 0 ? '+' : ''}${pct}%`}
          </span>
        )}
      </div>
    </div>
  );
}
