
-- Now set back to preparing to trigger the ZR Express create order function
UPDATE orders SET status = 'preparing' WHERE order_number IN ('ORD-00101', 'ORD-00104');
