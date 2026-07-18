
-- Add conversation tracking columns to auto_confirmation_logs
ALTER TABLE public.auto_confirmation_logs 
  ADD COLUMN IF NOT EXISTS conversation_status TEXT DEFAULT 'pending' CHECK (conversation_status IN ('pending', 'awaiting_reply', 'confirmed', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;
