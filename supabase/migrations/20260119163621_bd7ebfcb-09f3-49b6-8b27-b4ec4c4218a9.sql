-- Create delivery_fees table to store delivery prices per wilaya
CREATE TABLE public.delivery_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya_code text NOT NULL UNIQUE,
  wilaya_name text NOT NULL,
  home_delivery_fee numeric NOT NULL DEFAULT 0,
  stop_desk_fee numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "App users can view delivery fees"
ON public.delivery_fees FOR SELECT
USING (is_app_user(auth.uid()));

CREATE POLICY "Admins can insert delivery fees"
ON public.delivery_fees FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery fees"
ON public.delivery_fees FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete delivery fees"
ON public.delivery_fees FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_delivery_fees_updated_at
BEFORE UPDATE ON public.delivery_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default fees for all 58 wilayas
INSERT INTO public.delivery_fees (wilaya_code, wilaya_name, home_delivery_fee, stop_desk_fee) VALUES
('1', 'Adrar', 900, 600),
('2', 'Chlef', 600, 400),
('3', 'Laghouat', 800, 500),
('4', 'Oum El Bouaghi', 700, 450),
('5', 'Batna', 700, 450),
('6', 'Béjaïa', 600, 400),
('7', 'Biskra', 750, 500),
('8', 'Béchar', 900, 600),
('9', 'Blida', 500, 350),
('10', 'Bouira', 550, 400),
('11', 'Tamanrasset', 1200, 800),
('12', 'Tébessa', 750, 500),
('13', 'Tlemcen', 650, 450),
('14', 'Tiaret', 650, 450),
('15', 'Tizi Ouzou', 550, 400),
('16', 'Alger', 400, 300),
('17', 'Djelfa', 700, 450),
('18', 'Jijel', 650, 450),
('19', 'Sétif', 600, 400),
('20', 'Saïda', 700, 450),
('21', 'Skikda', 650, 450),
('22', 'Sidi Bel Abbès', 650, 450),
('23', 'Annaba', 600, 400),
('24', 'Guelma', 650, 450),
('25', 'Constantine', 550, 400),
('26', 'Médéa', 550, 400),
('27', 'Mostaganem', 600, 400),
('28', 'M''Sila', 700, 450),
('29', 'Mascara', 650, 450),
('30', 'Ouargla', 850, 550),
('31', 'Oran', 500, 350),
('32', 'El Bayadh', 850, 550),
('33', 'Illizi', 1200, 800),
('34', 'Bordj Bou Arréridj', 600, 400),
('35', 'Boumerdès', 500, 350),
('36', 'El Tarf', 700, 450),
('37', 'Tindouf', 1200, 800),
('38', 'Tissemsilt', 700, 450),
('39', 'El Oued', 800, 550),
('40', 'Khenchela', 750, 500),
('41', 'Souk Ahras', 700, 450),
('42', 'Tipaza', 500, 350),
('43', 'Mila', 650, 450),
('44', 'Aïn Defla', 550, 400),
('45', 'Naâma', 850, 550),
('46', 'Aïn Témouchent', 600, 400),
('47', 'Ghardaïa', 850, 550),
('48', 'Relizane', 600, 400),
('49', 'El M''Ghair', 850, 550),
('50', 'El Meniaa', 900, 600),
('51', 'Ouled Djellal', 800, 550),
('52', 'Bordj Badji Mokhtar', 1200, 800),
('53', 'Béni Abbès', 1000, 700),
('54', 'Timimoun', 1000, 700),
('55', 'Touggourt', 800, 550),
('56', 'Djanet', 1200, 800),
('57', 'In Salah', 1100, 750),
('58', 'In Guezzam', 1200, 800);