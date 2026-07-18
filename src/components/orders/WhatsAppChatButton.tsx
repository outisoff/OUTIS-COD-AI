import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChatPanel } from '@/components/orders/ChatPanel';
import { formatOrderNumber } from '@/lib/formatOrderNumber';
import { OrderWithItems } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAutoConfirmationLogs } from '@/hooks/useAutomationSettings';

interface WhatsAppChatButtonProps {
  order: OrderWithItems;
  whatsappStatus?: Record<string, boolean | null> | null;
  confirmationLogs?: any[];
  globalManualMode?: boolean;
  onToggleGlobalManual?: () => void;
  onSheetClose?: () => void;
}

/**
 * WhatsApp chat button that shows green when has WhatsApp, red/disabled when no WhatsApp.
 * Reusable across all pages (Commandes, Confirmation, Tracking, etc.)
 */
export function WhatsAppChatButton({
  order,
  whatsappStatus,
  confirmationLogs,
  globalManualMode,
  onToggleGlobalManual,
  onSheetClose,
}: WhatsAppChatButtonProps) {
  const queryClient = useQueryClient();
  const isChecked = whatsappStatus && order.customer_phone in whatsappStatus;
  const noWhatsApp = isChecked && whatsappStatus[order.customer_phone] === false;

  if (noWhatsApp) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive cursor-not-allowed opacity-70"
              disabled
              title="Pas de WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ce numéro n'a pas WhatsApp</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Sheet onOpenChange={async (open) => {
      if (!open) {
        const log = confirmationLogs?.find(l => l.order_id === order.id);
        if (log && log.conversation_status === 'manual_takeover') {
          await supabase.from('auto_confirmation_logs').update({ conversation_status: 'awaiting_reply' }).eq('id', log.id);
          queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
        }
        onSheetClose?.();
      }
    }}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
          title="Chat WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat - {formatOrderNumber(order.order_number)}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{order.customer_name} · {order.customer_phone}</p>
        </SheetHeader>
        <ChatPanel
          order={order}
          confirmationLogs={confirmationLogs}
          globalManualMode={globalManualMode}
          onToggleGlobalManual={onToggleGlobalManual}
        />
      </SheetContent>
    </Sheet>
  );
}
