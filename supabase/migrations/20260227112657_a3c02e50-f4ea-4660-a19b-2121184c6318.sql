
-- Add awaiting_stop_desk_selection to conversation_status constraint
ALTER TABLE public.auto_confirmation_logs 
DROP CONSTRAINT IF EXISTS auto_confirmation_logs_conversation_status_check;

ALTER TABLE public.auto_confirmation_logs 
ADD CONSTRAINT auto_confirmation_logs_conversation_status_check 
CHECK (conversation_status = ANY (ARRAY['pending', 'awaiting_reply', 'confirmed', 'cancelled', 'expired', 'manual_takeover', 'awaiting_delivery_type', 'contact_agent', 'completed', 'awaiting_stop_desk_selection']));
