ALTER TABLE public.charges
ADD COLUMN IF NOT EXISTS charge_type text NOT NULL DEFAULT 'fixe';

ALTER TABLE public.charges
DROP CONSTRAINT IF EXISTS charges_charge_type_check;

ALTER TABLE public.charges
ADD CONSTRAINT charges_charge_type_check CHECK (charge_type IN ('fixe', 'recurrente'));

CREATE INDEX IF NOT EXISTS idx_charges_charge_type ON public.charges(charge_type);

UPDATE public.charges SET charge_type = 'recurrente' WHERE is_recurring = true;