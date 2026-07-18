
-- Table for all Meta conversations (messages + comments)
CREATE TABLE public.meta_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL, -- 'facebook', 'instagram'
  conversation_type text NOT NULL DEFAULT 'message', -- 'message', 'comment'
  sender_id text NOT NULL, -- Meta user ID
  sender_name text, -- Display name
  sender_profile_pic text, -- Profile pic URL
  page_id text NOT NULL, -- Which page received this
  post_id text, -- For comments: the post ID
  thread_id text, -- Conversation thread ID
  last_message_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for individual messages within conversations
CREATE TABLE public.meta_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.meta_conversations(id) ON DELETE CASCADE NOT NULL,
  meta_message_id text, -- Original Meta message/comment ID
  direction text NOT NULL DEFAULT 'incoming', -- 'incoming', 'outgoing'
  content text,
  media_url text,
  media_type text, -- 'image', 'video', 'audio', 'file'
  is_comment boolean DEFAULT false,
  parent_comment_id text, -- For reply to comments
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meta_conversations_platform ON public.meta_conversations(platform);
CREATE INDEX idx_meta_conversations_sender ON public.meta_conversations(sender_id);
CREATE INDEX idx_meta_conversations_last_msg ON public.meta_conversations(last_message_at DESC);
CREATE INDEX idx_meta_messages_conversation ON public.meta_messages(conversation_id);
CREATE INDEX idx_meta_messages_meta_id ON public.meta_messages(meta_message_id);

-- RLS
ALTER TABLE public.meta_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage meta conversations" ON public.meta_conversations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Confirmateurs can view meta conversations" ON public.meta_conversations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'confirmateur'));

CREATE POLICY "Admins can manage meta messages" ON public.meta_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Confirmateurs can view meta messages" ON public.meta_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'confirmateur'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_messages;
