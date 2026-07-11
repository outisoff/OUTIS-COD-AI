import { useState, useRef, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { MessageCircle, User, Bot, Send, Paperclip, X, FileText, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { OrderWithItems } from '@/hooks/useOrders';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';

interface ChatPanelProps {
  order: OrderWithItems;
  confirmationLogs: any[] | undefined;
  /** If provided, uses session-level manual mode toggle */
  globalManualMode?: boolean;
  onToggleGlobalManual?: () => void;
}

export function ChatPanel({ order, confirmationLogs, globalManualMode, onToggleGlobalManual }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [togglingManual, setTogglingManual] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: automationSettings } = useAutomationSettings();

  // Check if AI confirmation is enabled globally
  const isAIEnabledGlobally = automationSettings?.confirmation?.enabled === true;

  const log = confirmationLogs?.find(l => l.order_id === order.id);
  
  // Merge conversation histories from ALL logs with the same phone number
  const allLogsForPhone = confirmationLogs?.filter(l => l.customer_phone === order.customer_phone) || [];
  const mergedHistory = useMemo(() => {
    if (allLogsForPhone.length === 0) return [];
    if (allLogsForPhone.length === 1) return (allLogsForPhone[0]?.conversation_history as any[]) || [];
    
    // Collect all messages from all logs, deduplicate by timestamp+content
    const allMessages: any[] = [];
    const seen = new Set<string>();
    for (const l of allLogsForPhone) {
      const hist = (l.conversation_history as any[]) || [];
      for (const msg of hist) {
        const key = `${msg.timestamp || ''}_${msg.role}_${(msg.content || '').substring(0, 50)}`;
        if (!seen.has(key)) {
          seen.add(key);
          allMessages.push(msg);
        }
      }
    }
    // Sort by timestamp
    return allMessages.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
  }, [allLogsForPhone]);
  
  const history = mergedHistory;
  
  // Use global session-level manual mode if provided, with DB as fallback
  // Also consider AI disabled globally as manual mode
  const isManualMode = !isAIEnabledGlobally || (globalManualMode !== undefined 
    ? (globalManualMode || log?.conversation_status === 'manual_takeover')
    : log?.conversation_status === 'manual_takeover');

  const toggleManualMode = async () => {
    if (onToggleGlobalManual) {
      onToggleGlobalManual();
    }
    
    if (log) {
      setTogglingManual(true);
      try {
        const currentManual = globalManualMode !== undefined ? globalManualMode : isManualMode;
        const newStatus = !currentManual ? 'manual_takeover' : 'awaiting_reply';
        const { error } = await supabase
          .from('auto_confirmation_logs')
          .update({ conversation_status: newStatus })
          .eq('id', log.id);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
      } catch (e: any) {
        toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
      } finally {
        setTogglingManual(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Max 16 MB', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getMediaType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  useEffect(() => {
    const scrollToBottom = () => {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    };
    const t1 = setTimeout(scrollToBottom, 50);
    const t2 = setTimeout(scrollToBottom, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [history.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const handleSend = async () => {
    const text = message.trim();
    if ((!text && !selectedFile) || sending) return;
    setSending(true);
    setUploading(!!selectedFile);
    try {
      let media_url: string | undefined;
      let media_type: string | undefined;
      let file_name: string | undefined;

      if (selectedFile) {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) throw new Error('Non authentifié');
        const ext = selectedFile.name.split('.').pop();
        const filePath = `${uid}/${order.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, selectedFile);
        if (uploadError) throw new Error('Échec upload: ' + uploadError.message);
        
        const { data: signedUrlData } = await supabase.storage.from('chat-media').createSignedUrl(filePath, 3600);
        media_url = signedUrlData?.signedUrl || '';
        media_type = getMediaType(selectedFile.type);
        file_name = selectedFile.name;
        setUploading(false);
      }

      const res = await supabase.functions.invoke('send-manual-message', {
        body: { order_id: order.id, message: text || undefined, phone: order.customer_phone, media_url, media_type, file_name },
      });
      if (res.error) throw res.error;
      if (!res.data?.success) throw new Error(res.data?.error || 'Échec envoi');
      setMessage('');
      clearFile();
      queryClient.invalidateQueries({ queryKey: ['auto-confirmation-logs'] });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec envoi WhatsApp', variant: 'destructive' });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 mt-2 min-h-0">
      {/* Mode toggle bar */}
      <div className={`flex items-center gap-2.5 mb-2 px-3 py-2 rounded-xl transition-all ${
        isManualMode 
          ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50' 
          : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50'
      }`}>
        <Button
          variant={isManualMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleManualMode}
          disabled={togglingManual || !log}
          className={`shrink-0 text-xs gap-1.5 rounded-lg shadow-sm transition-all ${
            isManualMode 
              ? 'bg-amber-500 hover:bg-amber-600 text-white border-0' 
              : 'bg-emerald-500 hover:bg-emerald-600 text-white border-0'
          }`}
        >
          {isManualMode ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          {isManualMode ? 'Manuel (IA off)' : 'IA (auto)'}
        </Button>
        <span className={`text-[11px] font-medium ${
          isManualMode 
            ? 'text-amber-600 dark:text-amber-400' 
            : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          {!isAIEnabledGlobally
            ? '⚠️ La confirmation IA est désactivée dans les paramètres'
            : isManualMode 
              ? '⚡ L\'IA ne répondra pas en mode manuel' 
              : '🤖 L\'IA répond automatiquement'}
        </span>
      </div>

      {/* Messages area */}
      <div className="flex-1 rounded-xl bg-[hsl(var(--muted)/0.3)] border border-border/50 overflow-hidden min-w-0">
        <ScrollArea className="h-full p-4" ref={scrollRef as any}>
          <div className="space-y-4 w-full min-w-0 overflow-hidden">
            {!history.length ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] h-full text-muted-foreground">
                <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Aucun message</p>
                <p className="text-xs">Envoyez un message pour démarrer</p>
              </div>
            ) : (
              history.map((msg: any, i: number) => (
                <div key={i} className={`flex min-w-0 ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm overflow-hidden break-words ${
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
                        {msg.role === 'user' ? 'Client' : (msg.manual ? (msg.sender ? msg.sender.replace(/@.*$/, '') : 'Vous') : 'IA')}
                      </span>
                      {msg.timestamp && (
                        <span className="text-[10px] opacity-50 ml-auto">
                          {format(new Date(msg.timestamp), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    {/* Media display */}
                    {msg.media_url && msg.media_type === 'image' && (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.media_url} alt="Image" className="rounded-lg mt-1 max-w-full max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                    {msg.media_url && msg.media_type === 'video' && (
                      <video src={msg.media_url} controls className="rounded-lg mt-1 max-w-full max-h-[200px]" />
                    )}
                    {msg.media_url && msg.media_type === 'document' && (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mt-1 text-xs underline opacity-80 hover:opacity-100">
                        <FileText className="h-3.5 w-3.5" />
                        {msg.file_name || 'Document'}
                      </a>
                    )}
                    {msg.content && <p className="whitespace-pre-wrap leading-relaxed break-all">{msg.content}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input area */}
      <div className="mt-2 pt-3 border-t border-border/50 space-y-2">
        {/* File preview */}
        {selectedFile && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-accent/50 border border-border/50">
            {filePreview && selectedFile.type.startsWith('image/') ? (
              <img src={filePreview} alt="preview" className="h-12 w-12 rounded-md object-cover" />
            ) : selectedFile.type.startsWith('video/') ? (
              <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                <Film className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={clearFile}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Joindre un fichier"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Écrire un message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="min-h-[44px] max-h-[100px] resize-none rounded-xl bg-card border-border/60 focus:border-primary/50"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={(!message.trim() && !selectedFile) || sending}
            className="shrink-0 h-11 w-11 rounded-xl shadow-sm"
          >
            {uploading ? (
              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
