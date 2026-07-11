import { useState } from 'react';
import { StickyNote, Send, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useConversationNotes, useAddConversationNote, useDeleteConversationNote } from '@/hooks/useConversationNotes';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConversationNotesPanelProps {
  conversationId: string | null;
}

export function ConversationNotesPanel({ conversationId }: ConversationNotesPanelProps) {
  const [noteText, setNoteText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: notes = [], isLoading } = useConversationNotes(conversationId);
  const addNote = useAddConversationNote();
  const deleteNote = useDeleteConversationNote();

  if (!conversationId) return null;

  const handleAddNote = () => {
    if (!noteText.trim() || !conversationId) return;
    addNote.mutate(
      { conversation_id: conversationId, content: noteText.trim() },
      { onSuccess: () => setNoteText('') }
    );
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <StickyNote className="h-4 w-4" />
        Notes internes
        {notes.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
            {notes.length}
          </Badge>
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Add note input */}
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ajouter une note interne..."
              className="min-h-[60px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote();
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={handleAddNote}
              disabled={!noteText.trim() || addNote.isPending}
              className="h-auto self-end"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Notes list */}
          <ScrollArea className={cn("max-h-[200px]", notes.length === 0 && "hidden")}>
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="font-medium">{note.user_name}</span>
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteNote.mutate({ id: note.id, conversation_id: note.conversation_id })}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-foreground">{note.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>

          {!isLoading && notes.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Aucune note pour cette conversation
            </p>
          )}
        </div>
      )}
    </div>
  );
}
