import { Phone } from 'lucide-react';

interface WhatsAppPhoneIndicatorProps {
  phone: string;
  whatsappStatus?: Record<string, boolean | null> | null;
  className?: string;
}

function formatPhoneDisplay(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+213')) cleaned = '0' + cleaned.substring(4);
  if (cleaned.startsWith('213') && cleaned.length === 12) cleaned = '0' + cleaned.substring(3);
  return cleaned;
}

/**
 * Displays a phone number with a phone icon (no WhatsApp status dot).
 */
export function WhatsAppPhoneIndicator({ phone, className }: WhatsAppPhoneIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Phone className="h-4 w-4 text-primary shrink-0" />
      <span className="text-primary text-base font-medium">{formatPhoneDisplay(phone)}</span>
    </div>
  );
}
