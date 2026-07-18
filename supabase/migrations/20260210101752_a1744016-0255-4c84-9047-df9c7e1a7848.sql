
-- Step 1: Add new enum values only
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'to_station';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'au_bureau';
