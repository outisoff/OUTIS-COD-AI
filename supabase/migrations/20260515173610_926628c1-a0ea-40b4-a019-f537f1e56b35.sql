ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS livreur_poll_msg_id text,
ADD COLUMN IF NOT EXISTS livreur_poll_to text;