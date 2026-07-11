import { Truck, Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';
import { toast } from 'sonner';

interface DeliveryCompanyBadgeProps {
  company: string;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  trackingNumber?: string | null;
}

// Company color mapping
const getCompanyStyles = (company: string) => {
  const name = company.toLowerCase();
  if (name.includes('zr')) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-300',
      icon: 'text-yellow-600',
    };
  }
  if (name.includes('maystro')) {
    return {
      bg: 'bg-blue-900',
      text: 'text-white',
      border: 'border-blue-800',
      icon: 'text-white',
    };
  }
  if (name.includes('rj360') || name.includes('ecotrack')) {
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-300',
      icon: 'text-orange-600',
    };
  }
  // Local livreur style (green)
  return {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    icon: 'text-green-600',
  };
};

// Get tracking URL for delivery company platform
const getTrackingUrl = (company: string, trackingNumber: string): string | null => {
  const name = company.toLowerCase();
  if (name.includes('zr')) {
    return `https://app.zrexpress.app/parcels/default/${trackingNumber}`;
  }
  if (name.includes('ecotrack') || name.includes('rj360')) {
    return `https://ecotrack.dz/suivi/${trackingNumber}`;
  }
  return null;
};

export function DeliveryCompanyBadge({ company, showIcon = true, size = 'default', className, trackingNumber }: DeliveryCompanyBadgeProps) {
  const styles = getCompanyStyles(company);
  const [copied, setCopied] = useState(false);

  const sizeClasses = size === 'sm' 
    ? 'text-[11px] px-1.5 py-0.5 gap-1' 
    : 'text-xs px-2 py-0.5 gap-1.5';
  
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  const badge = (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        sizeClasses,
        styles.bg,
        styles.text,
        styles.border,
        trackingNumber ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default',
        className
      )}
      onClick={(e) => {
        if (trackingNumber) e.stopPropagation();
      }}
    >
      {showIcon && <Truck className={cn(iconSize, styles.icon)} />}
      {company}
    </span>
  );


  if (!trackingNumber) return badge;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
    toast.success('N° de suivi copié');
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingUrl = getTrackingUrl(company, trackingNumber);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {badge}
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[220px] p-0 overflow-hidden" side="top" align="center" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-2 border-b">
          <p className="text-xs font-semibold text-primary">N° de suivi — {company}</p>
        </div>
        <div className="p-3 space-y-3">
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', styles.border, styles.bg)}>
            <code className={cn('text-sm font-mono font-semibold select-all flex-1', styles.text)}>
              {trackingNumber}
            </code>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-background transition-colors shrink-0"
              title="Copier"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline transition-colors px-1 py-0.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir sur {company}
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DeliveryCompanySelectItem({ company }: { company: string }) {
  const styles = getCompanyStyles(company);

  return (
    <span className="flex items-center gap-2">
      <Truck className={cn('h-4 w-4', styles.icon)} />
      <span className={styles.text}>{company}</span>
    </span>
  );
}

export { getCompanyStyles };
