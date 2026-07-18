-- Add swap fee columns to delivery_company_fees
ALTER TABLE public.delivery_company_fees
  ADD COLUMN IF NOT EXISTS swap_same_wilaya_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_diff_wilaya_fee numeric NOT NULL DEFAULT 0;

-- Seed ZR Express swap fees (flat rates across all wilayas)
UPDATE public.delivery_company_fees
SET swap_same_wilaya_fee = 50,
    swap_diff_wilaya_fee = 100,
    updated_at = now()
WHERE delivery_company = 'zr_express';