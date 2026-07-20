-- =====================================================================
-- Order Edit History — audit trail for manual edits from the UI
-- Run this once in the Supabase SQL editor (project fgndqoadnsbespjzkyhj).
-- Safe to re-run: everything is IF NOT EXISTS / OR REPLACE.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.order_edit_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  changed_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by          text,
  field               text NOT NULL,
  old_value           text,
  new_value           text,
  label               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_edit_history_order_id
  ON public.order_edit_history(order_id, created_at DESC);

-- Data API grants
GRANT SELECT, INSERT ON public.order_edit_history TO authenticated;
GRANT ALL ON public.order_edit_history TO service_role;

-- RLS
ALTER TABLE public.order_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_order_edit_history"  ON public.order_edit_history;
DROP POLICY IF EXISTS "authenticated_write_order_edit_history" ON public.order_edit_history;

-- Any authenticated user can read (same access surface as order_history).
CREATE POLICY "authenticated_read_order_edit_history"
  ON public.order_edit_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert only rows attributed to themselves,
-- or rows with no explicit user (e.g. attributed via changed_by label).
CREATE POLICY "authenticated_write_order_edit_history"
  ON public.order_edit_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by_user_id IS NULL
    OR changed_by_user_id = auth.uid()
  );
