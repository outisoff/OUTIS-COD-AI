
CREATE TABLE public.ai_chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_conversations_user ON public.ai_chat_conversations(user_id, updated_at DESC);

ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON public.ai_chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON public.ai_chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON public.ai_chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON public.ai_chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON public.ai_chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_messages_conv ON public.ai_chat_messages(conversation_id, created_at);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own chat messages"
  ON public.ai_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own chat messages"
  ON public.ai_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own chat messages"
  ON public.ai_chat_messages FOR DELETE
  USING (auth.uid() = user_id);
