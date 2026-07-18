import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Send, X, Sparkles, Loader2, Check, AlertTriangle, Maximize2, Minimize2, BotMessageSquare, Wand2, Paperclip, Plus, ArrowUp, FileText, Image as ImageIcon, Trash2, BarChart3, Search, ListChecks, Columns, Zap, Package, Users, TrendingUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MentionPicker } from '@/components/chatbot/MentionPicker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsAdmin } from '@/hooks/useUserRoles';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Attachment = { name: string; mime: string; dataUrl: string };
type Msg = { role: 'user' | 'assistant' | 'tool'; content?: any; tool_calls?: any[]; tool_call_id?: string; attachments?: Attachment[] };

const AI_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
];

const SLASH_COMMANDS = [
  { icon: FileText, cmd: '/orders', desc: "Liste des commandes du jour", prompt: "Affiche les commandes d'aujourd'hui avec leur statut." },
  { icon: BarChart3, cmd: '/report', desc: 'Rapport de performance', prompt: 'Génère un rapport de performance des ventes pour cette semaine.' },
  { icon: Search, cmd: '/audit', desc: 'Audit complet du compte', prompt: 'Fais un audit complet: commandes, stock, taux de confirmation et livraison.' },
  { icon: ListChecks, cmd: '/plan', desc: "Plan de tâches complet", prompt: "Donne-moi un plan d'actions prioritaires pour aujourd'hui." },
  { icon: Columns, cmd: '/compare', desc: 'Comparer périodes', prompt: 'Compare les ventes de cette semaine vs la semaine dernière.' },
  { icon: Package, cmd: '/stock', desc: 'État du stock', prompt: 'Quels produits sont en rupture ou en stock faible ?' },
  { icon: Users, cmd: '/agents', desc: 'Performance des agents', prompt: "Affiche la performance des agents de confirmation aujourd'hui." },
  { icon: TrendingUp, cmd: '/top', desc: 'Top wilayas / produits', prompt: 'Top 5 des wilayas et des produits par commandes.' },
  { icon: ImageIcon, cmd: '/pending', desc: 'Commandes en attente', prompt: 'Affiche toutes les commandes en attente de confirmation.' },
  { icon: Zap, cmd: '/scale', desc: 'Plan de scaling', prompt: 'Suggère un plan de scaling basé sur les performances actuelles.' },
];

interface PendingAction { id: string; name: string; args: any }

const WRITE_LABELS: Record<string, string> = {
  update_order_status: 'Changer statut commande',
  update_order: 'Modifier commande',
  delete_order: 'Supprimer commande',
  update_product: 'Modifier produit',
  delete_product: 'Supprimer produit',
  send_whatsapp: 'Envoyer WhatsApp',
  assign_agent: 'Assigner agent',
  insert_row: 'Insérer ligne',
  update_rows: 'Mettre à jour lignes',
  delete_rows: 'Supprimer lignes',
};

export function AIAssistantWidget() {
  const { isAdmin, isLoading } = useIsAdmin();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ actions: PendingAction[]; assistantMsg: any; conversationSoFar: Msg[] } | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const lastUserRef = useRef<{ content: string; attachments: Attachment[] } | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const slashFiltered = (() => {
    const t = input.trim().toLowerCase();
    if (!t.startsWith('/')) return [];
    return SLASH_COMMANDS.filter((c) => c.cmd.toLowerCase().startsWith(t) || c.desc.toLowerCase().includes(t.slice(1)));
  })();

  // Draggable FAB position (resets to default on refresh)
  const [fabPos, setFabPos] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth - 80,
    y: window.innerHeight - 80,
  }));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => {
      setFabPos((p) => ({
        x: Math.min(p.x, window.innerWidth - 64),
        y: Math.min(p.y, window.innerHeight - 64),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Reset FAB to default position whenever the chat is closed
  useEffect(() => {
    if (!open) {
      setFabPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    }
  }, [open]);

  const onFabPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: fabPos.x, origY: fabPos.y, moved: false };
  };
  const onFabPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    if (dragRef.current.moved) {
      const x = Math.max(8, Math.min(window.innerWidth - 64, dragRef.current.origX + dx));
      const y = Math.max(8, Math.min(window.innerHeight - 64, dragRef.current.origY + dy));
      setFabPos({ x, y });
    }
  };
  const onFabPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moved) {
      setPanelPos(computePanelPosFromFab(fabPos.x, fabPos.y));
      setOpen(true);
    }
  };

  // Draggable chat panel position (resets on refresh)
  const PANEL_W = 400;
  const PANEL_H = 550;
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const computePanelPosFromFab = (fx: number, fy: number) => ({
    x: Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, fx + 64 - PANEL_W)),
    y: Math.max(8, Math.min(window.innerHeight - PANEL_H - 8, fy - PANEL_H - 8)),
  });


  const onPanelHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panelDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: panelPos?.x ?? 0,
      origY: panelPos?.y ?? 0,
    };
  };
  const onPanelHeaderPointerMove = (e: React.PointerEvent) => {
    if (!panelDragRef.current) return;
    const dx = e.clientX - panelDragRef.current.startX;
    const dy = e.clientY - panelDragRef.current.startY;
    const x = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, panelDragRef.current.origX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - 60, panelDragRef.current.origY + dy));
    setPanelPos({ x, y });
  };
  const onPanelHeaderPointerUp = (e: React.PointerEvent) => {
    panelDragRef.current = null;
  };

  const openInFullPage = () => {
    try {
      const handoff = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: m.content }));
      sessionStorage.setItem('ai_widget_handoff', JSON.stringify(handoff));
    } catch {}
    setOpen(false);
    navigate('/chatbot');
  };

  useEffect(() => {
    const v = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (v) v.scrollTop = v.scrollHeight;
    if (!busy && !pending && open) {
      inputRef.current?.focus();
    }
  }, [messages, pending, busy, open]);

  if (isLoading || !isAdmin) return null;
  if (location.pathname.startsWith('/chatbot')) return null;

  const persistTurn = async (reply: string) => {
    try {
      const last = lastUserRef.current;
      if (!last) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let convId = conversationId;
      if (!convId) {
        const title = (typeof last.content === 'string' ? last.content : last.attachments[0]?.name || 'Conversation rapide').slice(0, 80);
        const { data: conv } = await (supabase as any)
          .from('ai_chat_conversations')
          .insert({ user_id: user.id, title, model })
          .select('id')
          .single();
        convId = conv?.id ?? null;
        setConversationId(convId);
      } else {
        await (supabase as any)
          .from('ai_chat_conversations')
          .update({ updated_at: new Date().toISOString(), model })
          .eq('id', convId);
      }
      if (convId) {
        await (supabase as any).from('ai_chat_messages').insert([
          { conversation_id: convId, user_id: user.id, role: 'user', content: typeof last.content === 'string' ? last.content : '[message multimodal]', attachments: last.attachments },
          { conversation_id: convId, user_id: user.id, role: 'assistant', content: reply, attachments: [] },
        ]);
      }
      lastUserRef.current = null;
    } catch (e) {
      console.warn('Persist widget chat failed', e);
    }
  };

  const callAI = async (
    history: Msg[],
    approvedToolCallIds: string[] = [],
    confirmationPayload?: { actions: PendingAction[]; assistantMsg: any; conversationSoFar: Msg[] }
  ) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: confirmationPayload?.conversationSoFar || history,
          approvedToolCallIds,
          model,
          pendingActions: confirmationPayload?.actions,
          assistantMessage: confirmationPayload?.assistantMsg,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.requiresConfirmation) {
        setPending({
          actions: data.pendingActions,
          assistantMsg: data.assistantMessage,
          conversationSoFar: data.conversationSoFar || history,
        });
      } else {
        const reply = data.reply;
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        setPending(null);
        setApprovedIds([]);
        void persistTurn(reply);
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['orders-confirmation'] }),
          queryClient.invalidateQueries({ queryKey: ['orders-tracking'] }),
          queryClient.invalidateQueries({ queryKey: ['orders'] }),
        ]);
      }
    } catch (e: any) {
      const message = e?.message || 'Impossible de contacter l\'IA';
      const isRateLimit = /429|Trop de requêtes/i.test(message);

      if (isRateLimit) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Le service IA est temporairement occupé. Réessayez dans quelques secondes.' }]);
        setPending(null);
        setApprovedIds([]);
      } else {
        toast({ title: 'Erreur IA', description: message, variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast({ title: 'Fichier trop volumineux', description: `${f.name} > 10 Mo`, variant: 'destructive' });
        continue;
      }
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      list.push({ name: f.name, mime: f.type || 'application/octet-stream', dataUrl });
    }
    setPendingAttachments((p) => [...p, ...list]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || busy) return;

    // Build OpenAI-compatible multimodal content if attachments present
    let content: any = text;
    if (pendingAttachments.length) {
      const parts: any[] = [];
      if (text) parts.push({ type: 'text', text });
      for (const a of pendingAttachments) {
        if (a.mime.startsWith('image/')) {
          parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
        } else {
          parts.push({ type: 'text', text: `[Fichier joint: ${a.name}]` });
        }
      }
      content = parts;
    }

    const sentAttachments = pendingAttachments;
    const newHistory: Msg[] = [...messages, { role: 'user', content, attachments: sentAttachments }];
    lastUserRef.current = { content: text, attachments: sentAttachments };
    setMessages(newHistory);
    setInput('');
    setPendingAttachments([]);
    await callAI(newHistory);
  };

  const confirmActions = async () => {
    if (!pending) return;
    const newApproved = [...approvedIds, ...pending.actions.map((a) => a.id)];
    setApprovedIds(newApproved);
    setPending(null);
    await callAI(messages, newApproved, pending);
  };

  const rejectActions = () => {
    if (!pending) return;
    const cancelMsg = `J'ai annulé l'action: ${pending.actions.map((a) => WRITE_LABELS[a.name] || a.name).join(', ')}.`;
    setMessages((prev) => [...prev, { role: 'assistant', content: cancelMsg }]);
    setPending(null);
  };

  const reset = () => {
    setMessages([]);
    setPending(null);
    setApprovedIds([]);
    setInput('');
    setConversationId(null);
    lastUserRef.current = null;
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          aria-label="AI Assistant"
          title="Glisser pour déplacer • Cliquer pour ouvrir"
          className="group fixed z-50 h-14 w-14 rounded-full flex items-center justify-center text-primary-foreground hover:scale-110 active:scale-95 transition-transform duration-200 touch-none cursor-grab active:cursor-grabbing"
          style={{
            left: fabPos.x,
            top: fabPos.y,
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(262 83% 58%))',
            boxShadow: '0 10px 30px -8px hsl(var(--primary) / 0.55), 0 4px 12px -2px hsl(262 83% 58% / 0.4)',
          }}
        >
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-40 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(262 83% 58%))', animationDuration: '2.5s' }}
          />
          <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 blur-md opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <BotMessageSquare className="relative h-6 w-6 drop-shadow-sm pointer-events-none" />
          <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse pointer-events-none" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 bg-card rounded-2xl flex flex-col overflow-hidden",
            "border-2 border-primary/30 ring-1 ring-primary/10",
            "shadow-[0_25px_60px_-15px_hsl(var(--primary)/0.45),0_10px_25px_-5px_rgba(0,0,0,0.2)]",
            "backdrop-blur-sm",
            expanded
              ? "inset-4 md:inset-10"
              : "w-[400px] h-[550px] max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)]"
          )}
          style={!expanded && panelPos ? { left: panelPos.x, top: panelPos.y } : undefined}
          onWheel={(e) => {
            // Allow page scroll when wheel is over the chat panel.
            // If the wheel happens inside the messages viewport and it can still scroll
            // in the wheel direction, let it scroll normally. Otherwise scroll the window.
            const viewport = scrollRef.current?.querySelector(
              '[data-radix-scroll-area-viewport]'
            ) as HTMLElement | null;
            const insideViewport = viewport && viewport.contains(e.target as Node);
            if (insideViewport && viewport) {
              const atTop = viewport.scrollTop <= 0;
              const atBottom =
                viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
              const goingDown = e.deltaY > 0;
              const goingUp = e.deltaY < 0;
              const canScrollHere = (goingDown && !atBottom) || (goingUp && !atTop);
              if (canScrollHere) return; // let ScrollArea handle it
            }
            window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' });
          }}
        >
          {/* Header */}
          <div
            onPointerDown={!expanded ? onPanelHeaderPointerDown : undefined}
            onPointerMove={!expanded ? onPanelHeaderPointerMove : undefined}
            onPointerUp={!expanded ? onPanelHeaderPointerUp : undefined}
            className={cn(
              "relative flex items-center justify-between px-4 py-3 select-none overflow-hidden",
              "bg-gradient-to-r from-primary via-primary to-purple-600 text-primary-foreground",
              !expanded && "cursor-grab active:cursor-grabbing touch-none"
            )}
          >
            {/* Decorative glow */}
            <span className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <span className="pointer-events-none absolute -bottom-12 right-10 h-32 w-32 rounded-full bg-purple-300/20 blur-2xl" />

            <div className="relative flex items-center gap-2.5">
              <div className="relative h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center shadow-lg">
                <BotMessageSquare className="h-4.5 w-4.5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-primary animate-pulse" />
              </div>
              <div className="leading-tight">
                <h3 className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
                  Outis IA
                  <Sparkles className="h-3 w-3 text-amber-200" />
                </h3>
                <p className="text-[10px] text-white/70">En ligne · Assistant intelligent</p>
              </div>
            </div>
            <div className="relative flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/15 rounded-lg"
                onClick={openInFullPage}
                title="Ouvrir dans la page Chat AI"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/15 rounded-lg"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="py-10 flex flex-col items-center justify-center">
                  {/* Hero with concentric pulse rings */}
                  <div className="relative h-40 w-40 flex items-center justify-center mb-5">
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: 'ring-expand 2.4s ease-out infinite' }} />
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: 'ring-expand 2.4s ease-out infinite', animationDelay: '0.8s' }} />
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: 'ring-expand 2.4s ease-out infinite', animationDelay: '1.6s' }} />
                    <div className="relative h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40" style={{ animation: 'soft-float 3.5s ease-in-out infinite' }}>
                      <BotMessageSquare className="h-7 w-7 text-primary-foreground" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center px-4">
                    Bonjour ! Je suis Outis AI. Comment puis-je vous aider aujourd'hui ?
                  </p>
                </div>
              )}

              {messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m.content)).map((m, i) => {
                const textContent = typeof m.content === 'string'
                  ? m.content
                  : Array.isArray(m.content)
                    ? m.content.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join('\n')
                    : '';
                return (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm space-y-2',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    )}>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.attachments.map((a, ai) => a.mime.startsWith('image/') ? (
                            <img key={ai} src={a.dataUrl} alt={a.name} className="h-16 w-16 rounded-md object-cover border border-background/20" />
                          ) : (
                            <div key={ai} className="flex items-center gap-1.5 rounded-md bg-background/20 px-2 py-1 text-[11px]">
                              <FileText className="h-3 w-3" /> <span className="truncate max-w-[120px]">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {textContent && (
                        m.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                            <ReactMarkdown>{textContent}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{textContent}</p>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pending confirmation card */}
              {pending && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-semibold">Confirmation requise</span>
                  </div>
                  {pending.actions.map((a) => (
                    <div key={a.id} className="text-xs bg-background/60 rounded-lg p-2">
                      <p className="font-medium">{WRITE_LABELS[a.name] || a.name}</p>
                      <pre className="text-[10px] mt-1 text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(a.args, null, 2)}
                      </pre>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={confirmActions} disabled={busy} className="flex-1 h-8 text-xs">
                      <Check className="h-3.5 w-3.5 mr-1" /> Confirmer
                    </Button>
                    <Button size="sm" variant="outline" onClick={rejectActions} disabled={busy} className="flex-1 h-8 text-xs">
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {busy && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs text-muted-foreground">Réflexion...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-3 bg-muted/20">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.csv,.json,.md"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <div className="w-full bg-card border rounded-2xl shadow-sm p-3">
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pendingAttachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1 text-xs">
                      {a.mime.startsWith('image/') ? (
                        <img src={a.dataUrl} alt={a.name} className="h-7 w-7 rounded object-cover" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-[110px] truncate">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingAttachments((p) => p.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-foreground"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                {slashOpen && slashFiltered.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-popover shadow-lg z-20">
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b">Commandes rapides</div>
                    {slashFiltered.map(({ icon: Icon, cmd, desc, prompt }, i) => (
                      <button
                        key={cmd}
                        type="button"
                        onMouseEnter={() => setSlashIndex(i)}
                        onClick={() => { setInput(`${cmd} `); setSlashOpen(false); inputRef.current?.focus(); }}
                        className={cn(
                          'flex items-center gap-3 text-left w-full px-3 py-2 transition-colors',
                          i === slashIndex ? 'bg-accent' : 'hover:bg-accent/60'
                        )}
                      >
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-primary">{cmd}</span>
                        <span className="text-sm text-muted-foreground truncate">{desc}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    const open = v.trim().startsWith('/') && !v.includes('\n');
                    setSlashOpen(open);
                    setSlashIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (slashOpen && slashFiltered.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % slashFiltered.length); return; }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + slashFiltered.length) % slashFiltered.length); return; }
                      if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); return; }
                      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                        e.preventDefault();
                        const sel = slashFiltered[slashIndex];
                        if (sel) { setInput(`${sel.cmd} `); setSlashOpen(false); inputRef.current?.focus(); }
                        return;
                      }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask OUTIS AI... (tapez / pour les commandes)"
                  rows={1}
                  className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none disabled:opacity-100 disabled:cursor-text"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    type="button"
                    onClick={() => {
                      setInput('/');
                      setSlashOpen(true);
                      setSlashIndex(0);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    title="Commandes rapides"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Joindre un fichier"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <MentionPicker align="end" side="top" onSelect={(text) => setInput((prev) => (prev.length && !/\s$/.test(prev) ? prev + ' ' : prev) + text)} />
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                      >
                        {AI_MODELS.find((m) => m.value === model)?.label ?? 'Modèle'}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Modèle IA</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {AI_MODELS.map((m) => (
                        <DropdownMenuItem key={m.value} onClick={() => setModel(m.value)}>
                          {model === m.value && <Check className="h-3.5 w-3.5 mr-2" />}
                          <span className={cn(model !== m.value && 'ml-[22px]')}>{m.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={handleSend}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={busy || (!input.trim() && pendingAttachments.length === 0) || !!pending}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
