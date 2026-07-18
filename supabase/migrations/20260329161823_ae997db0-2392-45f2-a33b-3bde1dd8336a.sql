DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM orders WHERE order_number = 'ORD-00170';