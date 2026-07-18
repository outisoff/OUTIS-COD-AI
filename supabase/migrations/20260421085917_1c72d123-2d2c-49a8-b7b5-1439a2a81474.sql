ALTER TABLE public.charges
ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'one_time';

ALTER TABLE public.charges
DROP CONSTRAINT IF EXISTS charges_frequency_check;

ALTER TABLE public.charges
ADD CONSTRAINT charges_frequency_check CHECK (frequency IN ('one_time','weekly','monthly','yearly','per_order'));

CREATE INDEX IF NOT EXISTS idx_charges_frequency ON public.charges(frequency);