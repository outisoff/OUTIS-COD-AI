
-- Clear old tracking numbers so the trigger can re-create them on ZR Express
UPDATE orders SET tracking_number = NULL WHERE order_number IN ('ORD-00101', 'ORD-00104');

-- Remove old delivery lock records
DELETE FROM deliveries WHERE id IN ('eaa9b1f8-55ef-4769-9cd0-c69abd11d632', '9a5e0c7d-f23f-4c2d-bdd9-4cee22e75375');
