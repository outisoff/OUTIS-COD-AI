import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { cn } from '@/lib/utils';

export type Tone = 'primary' | 'success' | 'destructive' | 'warning';

const toneClasses: Record<Tone, { accent: string; iconColor: string; bar: string; label: string; spark: string }> = {
  primary:     { accent: 'before:bg-primary',     iconColor: 'text-primary',     bar: 'bg-primary',     label: 'text-primary',     spark: 'hsl(var(--primary))' },
  success:     { accent: 'before:bg-success',     iconColor: 'text-success',     bar: 'bg-success',     label: 'text-success',     spark: 'hsl(var(--success))' },
  destructive: { accent: 'before:bg-destructive', iconColor: 'text-destructive', bar: 'bg-destructive', label: 'text-destructive', spark: 'hsl(var(--destructive))' },
  warning:     { accent: 'before:bg-warning',     iconColor: 'text-warning',     bar: 'bg-warning',     label: 'text-warning',     spark: 'hsl(var(--warning))' },
};
const defaultTone = { accent: 'before:bg-muted-foreground/40', iconColor: 'text-muted-foreground', bar: 'bg-muted-foreground/40', label: 'text-muted-foreground', spark: 'hsl(var(--muted-foreground))' };

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  rawValue: number;
  previousValue: number;
  formatValue: (v: number) => string;
  tone?: Tone;
  series?: number[];
  invertTrend?: boolean; // for cost KPIs where lower is better
  comparePeriodLabel: string;
  onClick?: () => void;
}

function formatDelta(current: number, previous: number): { pct: number | null; abs: number } {
  const abs = current - previous;
  if (previous === 0) return { pct: current === 0 ? 0 : null, abs };
  const pct = (abs / Math.abs(previous)) * 100;
  return { pct: Math.round(pct * 10) / 10, abs };
}

export function KpiCardRich({
  icon: Icon, label, value, rawValue, previousValue, formatValue,
  tone, series = [], invertTrend, comparePeriodLabel, onClick,
}: Props) {
  const t = tone ? toneClasses[tone] : defaultTone;
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
        'group relative overflow-hidden bg-card rounded-xl border border-border p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-xl before:transition-all',
        'hover:before:w-1.5',
        t.accent,
        isClickable && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40',
      )}
    >
      {/* Header: label + icon */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className={cn('text-[11px] font-semibold uppercase tracking-wider', t.label)}>
          {label}
        </p>
        <Icon className={cn('h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110', t.iconColor)} />
      </div>

      {/* Value */}
      <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground leading-none mb-3">
        {value}
      </p>

      {/* Trend pill + previous */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold', trendBg, trendColor)}>
          <TrendIcon className="h-3 w-3" />
          {pct === null ? 'N/A' : `${pct > 0 ? '+' : ''}${pct}%`}
        </span>
        <span className="text-[11px] text-muted-foreground">
          vs {comparePeriodLabel}: <span className="font-medium tabular-nums">{formatValue(previousValue)}</span>
        </span>
      </div>
    </div>
  );
}
