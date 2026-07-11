import { useState, useRef, useEffect, useMemo } from 'react';
import { BUILTIN_SLASH_COMMANDS, getEffectiveBuiltins } from '@/lib/slashCommands';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, MessageCircle, Inbox, MessageSquare, Sparkles, BotMessageSquare, FileText, ArrowUp, ArrowDown, Wand2, Paperclip, Maximize2, Loader2, Plus, Trash2, History, BarChart3, Search, ListChecks, Columns, Mic, Image as ImageIcon, Zap, Package, Users, TrendingUp, ChevronDown, Pencil, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMetaIntegration } from '@/hooks/useMetaIntegration';
import { MetaInbox } from '@/components/chatbot/MetaInbox';
import { CommentsInbox } from '@/components/chatbot/CommentsInbox';
import { useMetaConversations, useMetaConversationsRealtime } from '@/hooks/useMetaInbox';
import { CheckCircle2 } from 'lucide-react';
import { MentionPicker } from '@/components/chatbot/MentionPicker';

interface Attachment {
  name: string;
  dataUrl: string;
  mime: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  attachments?: Attachment[];
}

const GREETING: Message = {
  id: 'greeting',
  content: 'Bonjour ! Je suis votre assistant OUTIS COD. Comment puis-je vous aider ?',
  role: 'assistant',
  timestamp: new Date(),
};

interface ChatConversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function Chatbot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRecents, setShowRecents] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  const AI_MODELS = [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Rapide • équilibré' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', hint: 'Le plus rapide' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Raisonnement profond' },
    { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', hint: 'Nouvelle génération' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', hint: 'OpenAI • rapide' },
    { value: 'openai/gpt-5', label: 'GPT-5', hint: 'OpenAI • le plus puissant' },
    { value: 'openai/gpt-5.2', label: 'GPT-5.2', hint: 'OpenAI • dernier' },
  ];

  const ICONS_MAP: Record<string, any> = { FileText, BarChart3, Search, ListChecks, Columns, Package, Users, TrendingUp, ImageIcon, Zap };

  const [builtinTick, setBuiltinTick] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'outis_builtin_overrides' || e.key === 'outis_builtin_hidden' || e.key === 'outis_custom_skills') {
        setBuiltinTick(t => t + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    const onFocus = () => setBuiltinTick(t => t + 1);
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, []);

  const effectiveBuiltins = useMemo(() => {
    return getEffectiveBuiltins().map(b => ({ icon: ICONS_MAP[b.iconName] || Sparkles, cmd: b.cmd, desc: b.desc, prompt: b.prompt }));
  }, [builtinTick]);

  type CustomSkill = { cmd: string; desc: string; prompt: string };
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>(() => {
    try {
      const raw = localStorage.getItem('outis_custom_skills');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('outis_custom_skills', JSON.stringify(customSkills)); } catch {}
  }, [customSkills]);

  const SLASH_COMMANDS = [
    ...effectiveBuiltins,
    ...customSkills.map(s => ({ icon: Sparkles, cmd: s.cmd, desc: s.desc, prompt: s.prompt, custom: true as const })),
  ];

  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState<CustomSkill>({ cmd: '', desc: '', prompt: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const resetSkillDraft = () => { setSkillDraft({ cmd: '', desc: '', prompt: '' }); setEditingIndex(null); };

  const saveSkill = () => {
    let cmd = skillDraft.cmd.trim();
    if (!cmd) return;
    if (!cmd.startsWith('/')) cmd = '/' + cmd;
    cmd = cmd.replace(/\s+/g, '-').toLowerCase();
    const desc = skillDraft.desc.trim() || cmd;
    const prompt = skillDraft.prompt.trim();
    if (!prompt) {
      toast({ title: 'Prompt requis', description: 'Veuillez saisir un prompt pour cette compétence.', variant: 'destructive' });
      return;
    }
    const isBuiltin = BUILTIN_SLASH_COMMANDS.some(b => b.cmd === cmd);
    if (isBuiltin) {
      toast({ title: 'Commande réservée', description: `${cmd} est une commande intégrée.`, variant: 'destructive' });
      return;
    }
    const dupIdx = customSkills.findIndex(s => s.cmd === cmd);
    if (dupIdx !== -1 && dupIdx !== editingIndex) {
      toast({ title: 'Doublon', description: `${cmd} existe déjà.`, variant: 'destructive' });
      return;
    }
    const next = [...customSkills];
    const entry = { cmd, desc, prompt };
    if (editingIndex !== null) next[editingIndex] = entry;
    else next.push(entry);
    setCustomSkills(next);
    resetSkillDraft();
  };

  const deleteSkill = (idx: number) => {
    setCustomSkills(prev => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) resetSkillDraft();
  };

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashFiltered = (() => {
    const t = input.trim().toLowerCase();
    if (!t.startsWith('/')) return [];
    return SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().startsWith(t) || c.desc.toLowerCase().includes(t.slice(1)));
  })();

  const { data: metaIntegration } = useMetaIntegration();
  const { data: allConversations = [], isLoading: loadingConversations } = useMetaConversations();
  useMetaConversationsRealtime();

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const unreadMessages = allConversations.filter(c => !c.is_read && c.conversation_type === 'message').length;
  const unreadComments = allConversations.filter(c => !c.is_read && c.conversation_type === 'comment').length;

  const clearScheduledScroll = () => {
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth', force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (!force && !isAtBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const scheduleScrollToBottom = (behavior: ScrollBehavior = 'smooth', force = false) => {
    clearScheduledScroll();
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollToBottom(behavior, force);
    });
  };

  // Track whether user is near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 120;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance <= threshold;
      isAtBottomRef.current = atBottom;
      setShowJumpToBottom(!atBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [conversationId, activeTab]);

  useEffect(() => () => clearScheduledScroll(), []);

  // Reset to bottom on conversation/tab change
  useEffect(() => {
    isAtBottomRef.current = true;
    setShowJumpToBottom(false);
    scheduleScrollToBottom('auto', true);
  }, [conversationId, activeTab]);

  // Auto-follow new messages only if user is at bottom
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    scheduleScrollToBottom('smooth');
    const t1 = setTimeout(() => scrollToBottom('smooth'), 120);
    return () => {
      clearTimeout(t1);
    };
  }, [messages]);

  const loadConversations = async () => {
    const { data } = await (supabase as any)
      .from('ai_chat_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);
    setConversations(data || []);
  };

  useEffect(() => { loadConversations(); }, []);

  // Handoff from floating AI widget — restore in-flight conversation
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ai_widget_handoff');
      if (!raw) return;
      sessionStorage.removeItem('ai_widget_handoff');
      const arr = JSON.parse(raw) as Array<{ role: 'user' | 'assistant'; content: string }>;
      if (!Array.isArray(arr) || arr.length === 0) return;
      const restored: Message[] = arr.map((m, i) => ({
        id: `handoff-${i}-${Date.now()}`,
        role: m.role,
        content: m.content,
        timestamp: new Date(),
      }));
      setMessages([GREETING, ...restored]);
      setActiveTab('chat');
    } catch {}
  }, []);

  const loadConversation = async (id: string) => {
    const { data } = await (supabase as any)
      .from('ai_chat_messages')
      .select('id, role, content, attachments, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    const msgs: Message[] = (data || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.created_at),
      attachments: Array.isArray(m.attachments) && m.attachments.length ? m.attachments : undefined,
    }));
    setMessages([GREETING, ...msgs]);
    setConversationId(id);
    setShowHistory(false);
  };

  const newConversation = () => {
    setMessages([GREETING]);
    setConversationId(null);
    setShowHistory(false);
  };

  const deleteConversation = async (id: string) => {
    await (supabase as any).from('ai_chat_conversations').delete().eq('id', id);
    if (conversationId === id) newConversation();
    loadConversations();
  };

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    actions: Array<{ id: string; name: string; args: any }>;
    conversationSoFar: any[];
    assistantMessage: any | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMention = (text: string) => {
    const ta = textareaRef.current;
    setInput((prev) => {
      const start = ta?.selectionStart ?? prev.length;
      const end = ta?.selectionEnd ?? prev.length;
      const before = prev.slice(0, start);
      const after = prev.slice(end);
      const needsSpace = before.length > 0 && !/\s$/.test(before);
      const insert = (needsSpace ? ' ' : '') + text;
      const next = before + insert + after;
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const pos = (before + insert).length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos, pos);
        }
      });
      return next;
    });
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const out: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast({ title: 'Fichier trop volumineux', description: `${f.name} dépasse 10MB`, variant: 'destructive' });
        continue;
      }
      out.push({ name: f.name, mime: f.type, dataUrl: await readFileAsDataUrl(f) });
    }
    setPendingAttachments((p) => [...p, ...out]);
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
      attachments: pendingAttachments,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const currentInput = input;
    setInput('');
    const sentAttachments = pendingAttachments;
    setPendingAttachments([]);
    setIsLoading(true);

    try {
      // Build OpenAI-compatible multimodal payload for messages with images
      const payload = newMessages.slice(1).map((m) => {
        if (m.attachments && m.attachments.length > 0) {
          const parts: any[] = [];
          if (m.content) parts.push({ type: 'text', text: m.content });
          for (const a of m.attachments) {
            if (a.mime.startsWith('image/')) {
              parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
            } else {
              parts.push({ type: 'text', text: `[Fichier joint: ${a.name}]` });
            }
          }
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      });
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: payload, model },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.requiresConfirmation) {
        setPendingConfirmation({
          actions: data.pendingActions || [],
          conversationSoFar: data.conversationSoFar || [],
          assistantMessage: data.assistantMessage || null,
        });
        setIsLoading(false);
        return;
      }

      const reply = data?.reply || data?.assistantMessage?.content || '';
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), content: reply, role: 'assistant', timestamp: new Date() },
      ]);
      setIsLoading(false);

      // Persist conversation + messages (background, no spinner)
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          let convId = conversationId;
          if (!convId) {
            const title = (currentInput || sentAttachments[0]?.name || 'Nouvelle conversation').slice(0, 80);
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
              { conversation_id: convId, user_id: user.id, role: 'user', content: currentInput, attachments: sentAttachments },
              { conversation_id: convId, user_id: user.id, role: 'assistant', content: reply, attachments: [] },
            ]);
            loadConversations();
          }
        } catch (persistErr) {
          console.warn('Persist chat failed', persistErr);
        }
      })();
    } catch (e: any) {
      const message = e?.message || 'Impossible de contacter l\'IA';
      const isRateLimit = /429|Trop de requêtes/i.test(message);

      if (isRateLimit) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            content: 'Le service IA est temporairement occupé. Réessayez dans quelques secondes.',
            role: 'assistant',
            timestamp: new Date(),
          },
        ]);
      } else {
        toast({ title: 'Erreur IA', description: message, variant: 'destructive' });
      }
      setIsLoading(false);
    }
  };

  const confirmPendingActions = async () => {
    if (!pendingConfirmation) return;
    setIsLoading(true);
    const approvedIds = pendingConfirmation.actions.map((a) => a.id);
    const conversationSoFar = pendingConfirmation.conversationSoFar;
    setPendingConfirmation(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: conversationSoFar,
          model,
          approvedToolCallIds: approvedIds,
          pendingActions: pendingConfirmation.actions,
          assistantMessage: pendingConfirmation.assistantMessage,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.requiresConfirmation) {
        setPendingConfirmation({
          actions: data.pendingActions || [],
          conversationSoFar: data.conversationSoFar || [],
          assistantMessage: data.assistantMessage || null,
        });
        setIsLoading(false);
        return;
      }
      const reply = data?.reply || '';
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), content: reply, role: 'assistant', timestamp: new Date() },
      ]);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Action échouée', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPendingActions = () => {
    setPendingConfirmation(null);
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), content: 'Action annulée.', role: 'assistant', timestamp: new Date() },
    ]);
  };

  const tabs = [
    { id: 'chat', label: 'Chat IA', icon: Sparkles, badge: 0 },
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadMessages },
    { id: 'comments', label: 'Commentaires', icon: MessageSquare, badge: unreadComments },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Meta Suite-style header */}
      <div className="flex items-center justify-between mb-0 pb-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
            <BotMessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Chat AI</h1>
            <p className="text-xs text-muted-foreground">Votre assistant intelligent</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'inbox' && <MetaInbox />}
        {activeTab === 'comments' && (
          <CommentsInbox conversations={allConversations} isLoading={loadingConversations} />
        )}
        {activeTab === 'chat' && (
          (() => {
            const hasConversation = messages.length > 1;
            const HeaderButtons = (
              <div className="flex items-center gap-1 px-3 py-2">
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg hover:bg-accent text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  <History className="h-4 w-4" />
                  Historique
                </button>
                <button
                  onClick={newConversation}
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg hover:bg-accent text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau chat
                </button>
              </div>
            );
            const HistorySidebar = (
              <div className="w-72 border-r bg-card/30 flex flex-col h-full">
                <div className="p-3 space-y-2 border-b">
                  <button
                    onClick={newConversation}
                    className="w-full inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Nouvelle conversation
                  </button>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full h-9 pl-8 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setShowRecents((s) => !s)}
                  className="w-full flex items-center justify-between px-3 pt-3 pb-1 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Récents</p>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !showRecents && "-rotate-90")} />
                </button>
                {showRecents && (
                  <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                    {filteredConversations.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-4 text-center">Aucune conversation</p>
                    )}
                    {filteredConversations.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm",
                          conversationId === c.id ? 'bg-muted' : 'hover:bg-muted/50'
                        )}
                        onClick={() => loadConversation(c.id)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-foreground">{c.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(c.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 mt-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-auto border-t p-2">
                  <button
                    onClick={() => navigate('/chatbot/prompts')}
                    className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg hover:bg-accent text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    title="Mes prompts (compétences)"
                  >
                    <Settings2 className="h-4 w-4" />
                    Mes prompts
                  </button>
                </div>
              </div>
            );
            const HeaderBar = !showHistory && HeaderButtons;
            const InputCard = (
              <div className="w-full bg-card border rounded-2xl shadow-sm p-4">
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
                {pendingAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pendingAttachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1 text-xs">
                        {a.mime.startsWith('image/') ? (
                          <img src={a.dataUrl} alt={a.name} className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="max-w-[140px] truncate">{a.name}</span>
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
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-xl shadow-lg overflow-hidden z-50 max-h-[280px] overflow-y-auto">
                      <div className="px-3 py-2 text-xs text-muted-foreground border-b flex items-center justify-between">
                        <span>Commandes & compétences</span>
                        <button
                          type="button"
                          onClick={() => { setSlashOpen(false); setSkillsDialogOpen(true); }}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Ajouter
                        </button>
                      </div>
                      {slashFiltered.map((item, i) => {
                        const { icon: Icon, cmd, desc, prompt } = item as any;
                        const isCustom = (item as any).custom;
                        return (
                          <button
                            key={cmd}
                            type="button"
                            onMouseEnter={() => setSlashIndex(i)}
                            onClick={() => { setInput(prompt); setSlashOpen(false); textareaRef.current?.focus(); }}
                            className={cn(
                              "flex items-center gap-3 text-left w-full px-3 py-2 transition-colors",
                              i === slashIndex ? "bg-accent" : "hover:bg-accent/60"
                            )}
                          >
                            <Icon className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-semibold text-primary">{cmd}</span>
                            <span className="text-sm text-muted-foreground truncate flex-1">{desc}</span>
                            {isCustom && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">custom</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Textarea
                    ref={textareaRef}
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
                        if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % slashFiltered.length); return; }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + slashFiltered.length) % slashFiltered.length); return; }
                        if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); return; }
                        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                          e.preventDefault();
                          const sel = slashFiltered[slashIndex];
                          if (sel) { setInput(`${sel.cmd} `); setSlashOpen(false); textareaRef.current?.focus(); }
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
                    className="min-h-0 resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => {
                        setInput('/');
                        setSlashOpen(true);
                        setSlashIndex(0);
                        requestAnimationFrame(() => textareaRef.current?.focus());
                      }}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <MentionPicker onSelect={(text) => insertMention(text)} side="top" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-muted-foreground hover:text-foreground focus:ring-0">
                        <span>{AI_MODELS.find((m) => m.value === model)?.label}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <div className="flex flex-col">
                              <span className="text-sm">{m.label}</span>
                              <span className="text-xs text-muted-foreground">{m.hint}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSend}
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      disabled={!input.trim() || isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            );

            const ChatBody = hasConversation ? (
              <div className="flex-1 flex flex-col min-h-0 relative">
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
                    {messages.slice(1).map((msg) => (
                      <div
                        key={msg.id}
                        className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-5 py-2.5 text-sm leading-relaxed max-w-[85%]",
                            msg.role === 'user'
                              ? 'bg-primary/15 text-foreground'
                              : 'bg-muted text-foreground'
                          )}
                        >
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {msg.attachments.map((a, i) =>
                                a.mime.startsWith('image/') ? (
                                  <img
                                    key={i}
                                    src={a.dataUrl}
                                    alt={a.name}
                                    className="max-h-40 rounded-lg"
                                    onLoad={() => {
                                      if (isAtBottomRef.current) {
                                        scheduleScrollToBottom('smooth');
                                      }
                                    }}
                                  />
                                ) : (
                                  <div key={i} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1 text-xs">
                                    <FileText className="h-3 w-3" />
                                    {a.name}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl px-5 py-2.5 bg-muted text-muted-foreground text-sm">
                          <Loader2 className="h-4 w-4 animate-spin inline" />
                        </div>
                      </div>
                    )}
                    {pendingConfirmation && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl px-5 py-3 bg-warning/10 border border-warning/30 text-sm max-w-[85%] space-y-3">
                          <div className="font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Confirmation requise
                          </div>
                          <div className="space-y-1.5">
                            {pendingConfirmation.actions.map((a) => (
                              <div key={a.id} className="text-xs bg-background/60 rounded-lg px-3 py-2">
                                <div className="font-medium text-foreground">{a.name}</div>
                                <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(a.args, null, 2)}</pre>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={confirmPendingActions} disabled={isLoading}>
                              Confirmer
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelPendingActions} disabled={isLoading}>
                              Annuler
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                {showJumpToBottom && (
                  <button
                    onClick={() => {
                      isAtBottomRef.current = true;
                      setShowJumpToBottom(false);
                      scrollToBottom('smooth', true);
                    }}
                    className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 h-9 w-9 rounded-full bg-background border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Aller en bas"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                )}
                <div className="border-t-0 px-6 pb-6 pt-2 bg-background">
                  <div className="max-w-3xl mx-auto">{InputCard}</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex items-center justify-center">
                <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center relative">
                  <div className="relative h-48 w-48 flex items-center justify-center mb-4 -translate-y-16">
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: 'ring-expand 2.4s ease-out infinite' }} />
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: 'ring-expand 2.4s ease-out infinite', animationDelay: '0.8s' }} />
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: 'ring-expand 2.4s ease-out infinite', animationDelay: '1.6s' }} />
                    <div className="relative h-16 w-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40" style={{ animation: 'soft-float 3.5s ease-in-out infinite' }}>
                      <BotMessageSquare className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                  <p className="text-center text-muted-foreground mb-8">
                    Bonjour ! Je suis Outis AI. Comment puis-je vous aider aujourd'hui ?
                  </p>
                  <div className="w-full mb-8">{InputCard}</div>
                </div>
              </div>
            );

            return (
              <div className="h-full flex">
                {HistorySidebar}
                <div className="flex-1 flex flex-col min-w-0">
                  
                  {ChatBody}
                </div>
              </div>
            );
          })()
        )}
      </div>

      <Dialog open={skillsDialogOpen} onOpenChange={(o) => { setSkillsDialogOpen(o); if (!o) resetSkillDraft(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compétences personnalisées (commandes /)</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {editingIndex !== null ? 'Modifier la compétence' : 'Nouvelle compétence'}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-cmd">Commande</Label>
                <Input
                  id="skill-cmd"
                  placeholder="/ma-commande"
                  value={skillDraft.cmd}
                  onChange={(e) => setSkillDraft(s => ({ ...s, cmd: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-desc">Description courte</Label>
                <Input
                  id="skill-desc"
                  placeholder="Ce que fait cette commande"
                  value={skillDraft.desc}
                  onChange={(e) => setSkillDraft(s => ({ ...s, desc: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-prompt">Prompt à envoyer</Label>
                <Textarea
                  id="skill-prompt"
                  rows={5}
                  placeholder="Le prompt complet envoyé à l'IA quand vous utilisez cette commande..."
                  value={skillDraft.prompt}
                  onChange={(e) => setSkillDraft(s => ({ ...s, prompt: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSkill} className="flex-1">
                  {editingIndex !== null ? 'Mettre à jour' : 'Ajouter'}
                </Button>
                {editingIndex !== null && (
                  <Button variant="outline" onClick={resetSkillDraft}>Annuler</Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mes compétences ({customSkills.length})
              </div>
              <div className="border rounded-lg divide-y max-h-[360px] overflow-y-auto">
                {customSkills.length === 0 && (
                  <p className="text-xs text-muted-foreground p-4 text-center">Aucune compétence personnalisée</p>
                )}
                {customSkills.map((s, i) => (
                  <div key={s.cmd} className="p-2 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-primary">{s.cmd}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.desc}</div>
                    </div>
                    <button
                      onClick={() => { setSkillDraft(s); setEditingIndex(i); }}
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteSkill(i)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                Commandes intégrées
              </div>
              <div className="border rounded-lg divide-y max-h-[140px] overflow-y-auto">
                {effectiveBuiltins.map((s: any) => (
                  <div key={s.cmd} className="p-2 flex items-start gap-2">
                    <s.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{s.cmd}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
