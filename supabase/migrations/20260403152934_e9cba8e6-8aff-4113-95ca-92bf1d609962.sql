
-- Temporarily set to confirmed then back to preparing to trigger zr-express-create-order
UPDATE orders SET status = 'confirmed' WHERE order_number IN ('ORD-00101', 'ORD-00104');
