import { useState, useRef, useEffect } from 'react';
import { Facebook, Instagram, MessageCircle, MessageSquare, Send, Search, CheckCircle2, User, Image as ImageIcon, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  useMetaConversations,
  useMetaConversationMessages,
  useMarkConversationRead,
  useSendMetaReply,
  useMetaConversationsRealtime,
  type MetaConversation,
} from '@/hooks/useMetaInbox';
import { ConversationNotesPanel } from '@/components/chatbot/ConversationNotesPanel';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function MetaInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyCommentId, setReplyCommentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading } = useMetaConversations(platformFilter);
  const { data: messages = [] } = useMetaConversationMessages(selectedConversation);
  const markRead = useMarkConversationRead();
  const sendReply = useSendMetaReply();
  useMetaConversationsRealtime();

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    return c.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sender_id.includes(searchQuery);
  });

  const unreadCount = conversations.filter(c => !c.is_read).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (conv: MetaConversation) => {
    setSelectedConversation(conv.id);
    setReplyCommentId(null);
    if (!conv.is_read) {
      markRead.mutate(conv.id);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedConversation) return;
    sendReply.mutate({
      conversation_id: selectedConversation,
      message: replyText.trim(),
      reply_to_comment_id: replyCommentId || undefined,
    }, {
      onSuccess: () => {
        setReplyText('');
        setReplyCommentId(null);
      },
    });
  };

  const getPlatformIcon = (platform: string, type: string) => {
    if (type === 'comment') return <MessageSquare className="h-3.5 w-3.5" />;
    if (platform === 'instagram') return <Instagram className="h-3.5 w-3.5" />;
    if (platform === 'tiktok') return <TikTokIcon className="h-3.5 w-3.5" />;
    if (platform === 'whatsapp') return <WhatsAppIcon className="h-3.5 w-3.5" />;
    return <Facebook className="h-3.5 w-3.5" />;
  };

  const getPlatformColor = (platform: string) => {
    if (platform === 'instagram') return 'bg-gradient-to-br from-purple-500 to-pink-500';
    if (platform === 'tiktok') return 'bg-gradient-to-br from-[#00f2ea] to-[#ff0050]';
    if (platform === 'whatsapp') return 'bg-gradient-to-br from-[#25d366] to-[#128c7e]';
    return 'bg-gradient-to-br from-blue-500 to-blue-600';
  };

  const getPlatformTextColor = (platform: string) => {
    if (platform === 'instagram') return 'text-pink-500';
    if (platform === 'tiktok') return 'text-[#00f2ea]';
    if (platform === 'whatsapp') return 'text-[#25d366]';
    return 'text-blue-600';
  };

  const platformFilters = [
    { id: 'all', label: 'Tout', icon: MessageCircle },
    { id: 'facebook', label: 'FB', icon: Facebook },
    { id: 'instagram', label: 'IG', icon: Instagram },
    { id: 'whatsapp', label: 'WA', icon: WhatsAppIcon },
    { id: 'tiktok', label: 'TT', icon: TikTokIcon },
  ];

  return (
    <div className="flex h-full rounded-xl overflow-hidden bg-card border shadow-sm">
      {/* Conversations List */}
      <div className={cn(
        "w-full md:w-[380px] border-r flex flex-col bg-card",
        selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une conversation..."
              className="pl-9 h-10 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          {/* Platform filter pills */}
          <div className="flex items-center gap-1.5">
            {platformFilters.map((pf) => {
              const Icon = pf.icon;
              const isActive = platformFilter === pf.id;
              return (
                <button
                  key={pf.id}
                  onClick={() => setPlatformFilter(pf.id)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {pf.label}
                </button>
              );
            })}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full ml-auto">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="h-12 w-12 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-2.5 w-32 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-sm font-medium">Aucune conversation</p>
              <p className="text-xs mt-1.5 max-w-[200px] mx-auto">Les messages et commentaires de vos réseaux apparaîtront ici</p>
            </div>
          ) : (
            <div>
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                    selectedConversation === conv.id
                      ? "bg-primary/8 border-l-2 border-l-primary"
                      : "hover:bg-muted/40 border-l-2 border-l-transparent",
                    !conv.is_read && selectedConversation !== conv.id && "bg-primary/4"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                      <AvatarImage src={conv.sender_profile_pic || undefined} />
                      <AvatarFallback className={cn("text-sm font-semibold text-white", getPlatformColor(conv.platform))}>
                        {conv.sender_name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 rounded-full p-[3px] shadow-sm",
                      "bg-card"
                    )}>
                      <div className={cn("flex items-center justify-center", getPlatformTextColor(conv.platform))}>
                        {getPlatformIcon(conv.platform, conv.conversation_type)}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        !conv.is_read ? "font-semibold text-foreground" : "text-foreground/80"
                      )}>
                        {conv.sender_name || conv.sender_id}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "text-xs truncate",
                        !conv.is_read ? "text-foreground/70" : "text-muted-foreground"
                      )}>
                        {conv.conversation_type === 'comment' ? '💬 Commentaire' : '✉️ Message'}
                      </span>
                      {!conv.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 ml-auto" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message View */}
      <div className={cn(
        "flex-1 flex flex-col bg-background",
        !selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b flex items-center gap-3 bg-card">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 rounded-full"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                <AvatarImage src={selectedConv.sender_profile_pic || undefined} />
                <AvatarFallback className={cn("text-sm font-semibold text-white", getPlatformColor(selectedConv.platform))}>
                  {selectedConv.sender_name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{selectedConv.sender_name || selectedConv.sender_id}</p>
                <div className="flex items-center gap-1.5">
                  <div className={getPlatformTextColor(selectedConv.platform)}>
                    {getPlatformIcon(selectedConv.platform, selectedConv.conversation_type)}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {selectedConv.platform} · {selectedConv.conversation_type === 'comment' ? 'Commentaire' : 'Message'}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-2 max-w-2xl mx-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                        msg.direction === 'outgoing'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card border rounded-bl-sm',
                        msg.is_comment && 'border-l-2 border-l-amber-400'
                      )}
                    >
                      {msg.media_url && (
                        <div className="mb-2">
                          {msg.media_type === 'image' ? (
                            <img src={msg.media_url} alt="" className="rounded-xl max-w-full max-h-48 object-cover" />
                          ) : (
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs underline opacity-80">
                              <ImageIcon className="h-3 w-3" /> Média
                            </a>
                          )}
                        </div>
                      )}
                      {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                      <p className={cn(
                        "text-[10px] mt-1.5 flex items-center gap-1",
                        msg.direction === 'outgoing' ? 'text-primary-foreground/50' : 'text-muted-foreground'
                      )}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {msg.direction === 'outgoing' && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                      </p>

                      {msg.is_comment && msg.direction === 'incoming' && msg.meta_message_id && (
                        <button
                          onClick={() => setReplyCommentId(msg.meta_message_id)}
                          className="text-[11px] mt-1 font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          ↩ Répondre
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Internal Notes */}
            <ConversationNotesPanel conversationId={selectedConversation} />

            {/* Reply Input */}
            <div className="border-t p-3 bg-card">
              {replyCommentId && (
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2 border border-primary/10">
                  <span className="text-primary font-medium">↩ Répondre au commentaire</span>
                  <button onClick={() => setReplyCommentId(null)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                  placeholder={
                    selectedConv.conversation_type === 'comment'
                      ? 'Répondre au commentaire...'
                      : 'Écrire un message...'
                  }
                  className="flex-1 rounded-full bg-muted/50 border-0 px-4 focus-visible:ring-1"
                  disabled={sendReply.isPending}
                />
                <Button
                  onClick={handleSendReply}
                  size="icon"
                  className="rounded-full shrink-0"
                  disabled={!replyText.trim() || sendReply.isPending || (selectedConv.conversation_type === 'comment' && !replyCommentId)}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {selectedConv.conversation_type === 'comment' && !replyCommentId && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Cliquez sur "↩ Répondre" sous un commentaire pour y répondre
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-5">
                <MessageCircle className="h-9 w-9 opacity-25" />
              </div>
              <p className="text-lg font-semibold text-foreground/70">Sélectionnez une conversation</p>
              <p className="text-sm mt-1.5 max-w-[280px] mx-auto">Choisissez une conversation pour voir les messages et y répondre</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
