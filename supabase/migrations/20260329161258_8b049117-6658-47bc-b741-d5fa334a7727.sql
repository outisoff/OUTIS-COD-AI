DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM orders WHERE order_number = 'ORD-00170';
UPDATE integrations SET api_secret = NULL WHERE id = '4176be68-4801-481d-a2b8-2b9c50f171d0' AND name = 'LightFunnel';