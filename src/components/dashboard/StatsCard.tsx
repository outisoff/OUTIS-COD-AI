import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  className?: string;
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  function StatsCard({ title, value, icon, trend, subtitle, className }, ref) {
    return (
      <div ref={ref} className={cn('stat-card', className)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="stat-label">{title}</p>
            <p className="stat-value mt-2">{value}</p>
            {trend && (
              <div className={cn('mt-2', trend.isPositive ? 'stat-trend-up' : 'stat-trend-down')}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
                {subtitle && <span className="text-muted-foreground ml-1">{subtitle}</span>}
              </div>
            )}
            {!trend && subtitle && (
              <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
            )}
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </div>
    );
  }
);

StatsCard.displayName = 'StatsCard';

export { StatsCard };
