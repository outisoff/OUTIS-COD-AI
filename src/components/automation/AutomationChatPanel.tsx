import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, MessageCircle, Send, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AutomationChatPanel({ log }: { log: any }) {
  const [togglingManual, setTogglingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const queryClient = useQueryClient();
  const history = (log?.conversation_history as any[]) || [];
  const isManualMode = log?.conversation_status === 'manual_takeover';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollToBottom = () => {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    };
    const t1 = setTimeout(scrollToBottom, 50);
    const t2 = setTimeout(scrollToBottom, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [history.length]);

  const handleSendManualMessage = async () => {
    if (!manualMessage.trim() || !log) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-manual-message', {
        body: {
          order_id: log.order_id,
          message: manualMessage.trim(),
          phone: log.customer_phone,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Message envoyé');
        setManualMessage('');
        queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
      } else {
        toast.error('Échec de l\'envoi');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const toggleManualMode = async () => {
    if (!log) return;
    setTogglingManual(true);
    try {
      const newStatus = isManualMode ? 'awaiting_reply' : 'manual_takeover';
      const { error } = await supabase
        .from('auto_confirmation_logs')
        .update({ conversation_status: newStatus })
        .eq('id', log.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
      
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setTogglingManual(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 mt-2 min-h-0">
      <div className="flex-1 rounded-xl bg-[hsl(var(--muted)/0.3)] border border-border/50 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef as any}>
          <div className="space-y-4">
            {!history.length && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Aucun message</p>
              </div>
            )}
            {history.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-card text-foreground border border-border/60 rounded-bl-md'
                    : 'bg-primary text-primary-foreground rounded-br-md'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {msg.role === 'user' 
                      ? <User className="h-3 w-3 opacity-60" /> 
                      : msg.manual ? <Send className="h-3 w-3 opacity-80" /> : <Bot className="h-3 w-3 opacity-80" />
                    }
                    <span className="text-[10px] font-medium opacity-70">
                      {msg.role === 'user' ? 'Client' : (msg.manual ? (msg.sender || 'Vous') : 'IA')}
                    </span>
                    {msg.timestamp && (
                      <span className="text-[10px] opacity-50 ml-auto">
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      {/* Send message input */}
      <div className="flex gap-2 mt-2">
        <Input
          value={manualMessage}
          onChange={(e) => setManualMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendManualMessage()}
          placeholder="Tapez votre message..."
          disabled={isSending || !log}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSendManualMessage}
          disabled={isSending || !manualMessage.trim() || !log}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {/* Manual mode toggle */}
      <div className="flex items-center gap-2 mt-1">
        <Button
          variant={isManualMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleManualMode}
          disabled={togglingManual || !log}
          className="shrink-0 text-xs gap-1.5"
        >
          {isManualMode ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          {isManualMode ? 'Mode Manuel (IA off)' : 'Mode IA (auto)'}
        </Button>
        {isManualMode && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">L'IA ne répondra pas tant que vous êtes en mode manuel</span>
        )}
      </div>
    </div>
  );
}
