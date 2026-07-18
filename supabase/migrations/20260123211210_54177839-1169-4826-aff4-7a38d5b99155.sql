-- Add 'at_station' to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'at_station' AFTER 'ready';