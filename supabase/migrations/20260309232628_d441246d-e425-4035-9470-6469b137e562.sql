
CREATE TABLE public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.meta_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App users can view conversation notes"
  ON public.conversation_notes FOR SELECT TO authenticated
  USING (is_app_user(auth.uid()));

CREATE POLICY "App users can insert conversation notes"
  ON public.conversation_notes FOR INSERT TO authenticated
  WITH CHECK (is_app_user(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins can delete conversation notes"
  ON public.conversation_notes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR user_id = auth.uid());
