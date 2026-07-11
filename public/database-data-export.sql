-- =====================================================
-- COMPLETE DATABASE DATA EXPORT
-- Platform: E-Commerce Order Management System
-- Generated: 2026-02-24
-- =====================================================

-- NOTE: Schema is in database-schema-export.sql
-- This file contains INSERT statements for all data

-- =====================================================
-- profiles (3 rows)
-- =====================================================
INSERT INTO public.profiles (id, email, full_name, avatar_url, is_approved, created_at, updated_at) VALUES
('2937dceb-297b-4082-b0d5-1e128002937b', 'admin@admin.com', 'ouss', 'https://ggrnsnbxdslhlvanymgo.supabase.co/storage/v1/object/public/chat-media/avatars/2937dceb-297b-4082-b0d5-1e128002937b.avif?t=1771456313054', true, '2026-02-18 19:53:32.046471+00', '2026-02-18 23:11:53.138648+00'),
('49bae3a9-4289-411b-9957-440ca7006393', 'outis.off@gmail.com', 'kenza', NULL, true, '2026-02-21 00:23:43.82352+00', '2026-02-21 00:23:43.82352+00'),
('eb131641-d6b1-4107-8e02-db83540734d5', 'ouss.off@gmail.com', 'oussama', NULL, true, '2026-02-21 01:22:35.473759+00', '2026-02-21 01:22:35.473759+00');

-- =====================================================
-- user_roles (3 rows)
-- =====================================================
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
('d821c20c-e659-40ac-b244-d601742f32cb', '2937dceb-297b-4082-b0d5-1e128002937b', 'admin', '2026-02-18 19:53:17.368739+00'),
('d790e32e-9728-452c-9aba-2e478b70baaf', '49bae3a9-4289-411b-9957-440ca7006393', 'confirmateur', '2026-02-21 00:23:44.198153+00'),
('b32e5680-4762-499c-9431-6b0399dff8a7', 'eb131641-d6b1-4107-8e02-db83540734d5', 'stock_manager', '2026-02-21 01:22:35.742113+00');

-- =====================================================
-- customers (1 row)
-- =====================================================
INSERT INTO public.customers (id, name, phone, wilaya, commune, address, notes, status, total_orders, total_spent, last_order_date, created_at, updated_at) VALUES
('15ca7e0e-a000-4778-8387-675da7ee5234', 'Oussama', '0541020072', '16 - Alger', 'El Achour', 'ouahrani', NULL, 'new', 0, 0, NULL, '2026-02-18 20:09:53.198651+00', '2026-02-18 20:09:53.198651+00');

-- =====================================================
-- products (2 rows)
-- =====================================================
INSERT INTO public.products (id, sku, name, category, description, purchase_price, selling_price, current_stock, reserved_stock, reorder_level, barcode, free_delivery, delivery_pricing_tier, custom_home_delivery_fee, custom_stop_desk_fee, average_purchase_price, created_at, updated_at) VALUES
('df6695dd-f539-4407-a03e-1f3b37705d6e', 'ali-mglr', 'Alien Mugler', 'Mode', NULL, 850, 3900, 112, 2, 10, NULL, false, 'standard', NULL, NULL, 894.9074074074074, '2026-02-18 20:09:31.017701+00', '2026-02-24 02:23:45.803949+00'),
('b6321786-ccfb-43ce-9b64-2518a0245d87', 'LINT-RG-DZ', 'Linterdit rouge', 'Batteries', NULL, 800, 2900, 20, 0, 10, NULL, true, 'standard', NULL, NULL, 0, '2026-02-24 06:17:49.517211+00', '2026-02-24 09:41:08.00484+00');

-- =====================================================
-- integrations (3 rows)
-- =====================================================
INSERT INTO public.integrations (id, integration_type, name, api_key, api_secret, webhook_url, spreadsheet_id, store_url, is_enabled, settings, created_at, updated_at) VALUES
('a44c3daa-8d36-4660-ac94-a5cd177df75c', 'delivery', 'ZR Express', 'c4140630-68cf-4186-971d-7a25b85c78a7', 'tnLMhRhnoMjejf8JtPh6NUYsqRAiyBILc7S0ZpyggkeLtRuDaFgOceOCA0rbh9oQ', 'https://ggrnsnbxdslhlvanymgo.supabase.co/functions/v1/zr-express-webhook', NULL, NULL, true, '{"tenant_id":"c4140630-68cf-4186-971d-7a25b85c78a7"}', '2026-02-19 23:46:03.397402+00', '2026-02-21 22:19:50.711706+00'),
('57988b79-159b-4375-ac18-cbfed3bb091b', 'delivery', 'RJ360', 'jaYITdsKJr7mC2ausODvrQgDVLiekwhyT57v6VTcCrjJ56Gu1dbfIEK9ih2D', NULL, NULL, NULL, 'https://rj360express.ecotrack.dz', true, '{}', '2026-02-19 23:37:50.362063+00', '2026-02-21 23:29:49.812066+00'),
('4176be68-4801-481d-a2b8-2b9c50f171d0', 'ecommerce', 'LightFunnel', NULL, NULL, NULL, NULL, NULL, false, '{}', '2026-02-23 06:21:52.219728+00', '2026-02-23 06:21:53.416179+00');

-- =====================================================
-- local_livreurs (1 row)
-- =====================================================
INSERT INTO public.local_livreurs (id, name, phone, wilaya, tarif, is_active, created_at, updated_at) VALUES
('b361446d-1a36-43dd-a576-eae9c687f2bc', 'Mouh', '0541020072', '16 - Alger', 500, true, '2026-02-23 06:33:29.201779+00', '2026-02-23 06:33:29.201779+00');

-- =====================================================
-- assignment_rules (2 rows)
-- =====================================================
INSERT INTO public.assignment_rules (id, rule_type, agent_name, match_value, priority, is_active, days_of_week, start_hour, end_hour, start_date, end_date, created_at, updated_at) VALUES
('1393b90e-954a-421d-a950-d8c074be1a65', 'product', 'kenza', 'Linterdit rouge', 0, true, '{}', 0, 23, NULL, NULL, '2026-02-24 09:57:41.151061+00', '2026-02-24 09:57:41.151061+00'),
('14e067ac-f27e-4321-ae50-bd3898e9db75', 'product', 'kenza', 'Alien Mugler ', 0, true, '{}', 0, 23, NULL, NULL, '2026-02-24 09:57:46.877359+00', '2026-02-24 09:57:46.877359+00');

-- =====================================================
-- assignment_settings (6 rows)
-- =====================================================
INSERT INTO public.assignment_settings (id, setting_key, setting_value, updated_at) VALUES
('468684e8-3554-48dd-b32e-a1b3da3786c6', 'mode', '"rules"', '2026-02-24 09:57:56.104884+00'),
('ee798124-221a-4baf-9e25-eac1aae54a78', 'delay_hours', '2', '2026-02-24 10:07:31.812565+00'),
('78169d42-6d82-4bf3-9498-80da0086dff2', 'auto_enabled', 'true', '2026-02-24 10:20:42.080876+00'),
('53960bac-35f4-4380-b6c3-2a1b429465cc', 'no_whatsapp_instant_assign', 'true', '2026-02-24 10:44:16.075429+00'),
('63a8fccc-7605-46d1-9261-e844c18c921c', 'working_hours', '{"start":9,"end":18}', '2026-02-24 10:49:12.117881+00'),
('a2f2e192-8c1d-4c3d-bd83-74a54f8a454c', 'stale_delay', '60', '2026-02-24 10:49:23.946005+00');

-- =====================================================
-- automation_settings (6 rows)
-- =====================================================
INSERT INTO public.automation_settings (id, setting_key, setting_value, created_at, updated_at) VALUES
('61921fbb-5a91-4d90-90d6-941de59ac0d8', 'wasender_config', '{"api_key":"29df47d7fa6e952d35473437dee67cb04b5a26695f21ac30c68a0018bd46f479"}', '2026-02-18 20:05:47.904191+00', '2026-02-18 20:05:47.904191+00'),
('aa99a47c-2c64-4013-aefb-69d24a68f12f', 'webhook_verify_token', '{"token":"f382811255a2285d5f369985e0199612"}', '2026-02-18 20:05:49.394224+00', '2026-02-18 20:05:49.394224+00'),
('ce8214eb-813e-48b0-9c5e-33e3210458ba', 'ai_provider', '{"api_key":"AIzaSyABw07nXbybW5I8SCqgBhoG8zEydtN61as","base_url":"","model":"gemini-2.0-flash-exp","provider":"google","use_external":true}', '2026-02-18 20:14:22.39813+00', '2026-02-18 20:14:22.39813+00'),
('b5b860e0-877c-4991-ab5c-d0016ebd0332', 'tracking_notifications', '{"custom_messages":{"at_station":"🏢 Votre commande {order} est arrivée à la station.","au_bureau":"🏢 Votre commande {order} est au bureau de livraison.","cancelled":"❌ Votre commande {order} a été annulée.","confirmed":"✅ Votre commande {order} a été confirmée !","delivered":"🎉 Votre commande {order} a été livrée. Merci !","en_livraison":"🛵 Votre commande {order} est en cours de livraison !","preparing":"📦 Votre commande {order} est en cours de préparation.","ready":"✅ Votre commande {order} est prête pour expédition.","shipped":"🚚 Votre commande {order} a été expédiée ! Suivi: {tracking}","to_station":"📍 Votre commande {order} est en route vers la station.","Échec_de_livraison":"⚠️ La livraison de votre commande {order} a échoué."},"enabled":true,"statuses":["confirmed","preparing","ready","shipped","to_station","at_station","au_bureau","en_livraison","delivered","Échec_de_livraison","cancelled"]}', '2026-02-19 20:25:57.096378+00', '2026-02-24 09:36:53.047725+00'),
('95d3fd2a-7f29-43fc-9d20-fb1bef456763', 'livreur_whatsapp_template', '{"enabled":true,"template":"📦 Nouvelle commande à livrer\n\n👤 Client: {customer_name}\n📞 Téléphone: {customer_phone}\n🏘️ Commune: {commune}\n📍 Adresse: {customer_address}\n📝 Produits:\n{products}\n\n💰 Total: {total_price} DA","trigger_statuses":["preparing"]}', '2026-02-23 09:48:15.476357+00', '2026-02-23 11:30:50.342006+00'),
('1c985cdf-a094-4c23-a229-522e03d48d48', 'confirmation', '{"enabled":true,"model":"google/gemini-3-flash-preview","system_prompt":"Tu es un assistant commercial professionnel pour OUTIS COD..."}', '2026-02-18 20:10:10.865663+00', '2026-02-24 09:36:49.16497+00');

-- =====================================================
-- stock_movements (1 row)
-- =====================================================
INSERT INTO public.stock_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, purchase_price, created_by, created_at) VALUES
('8df056ac-b71b-4ba3-aaa1-89b082da576b', 'df6695dd-f539-4407-a03e-1f3b37705d6e', 'entry', 11, 97, 108, NULL, NULL, NULL, NULL, '2026-02-21 22:06:06.56852+00');

-- =====================================================
-- delivery_company_fees (171 rows - Maystro wilayas)
-- Note: All fees are 0 (not yet configured)
-- Generating for wilayas 01-58 + extras
-- =====================================================
-- Use: SELECT * FROM delivery_company_fees to get full data
-- Or import via the application's tariff import feature

-- =====================================================
-- EMPTY TABLES (0 rows):
-- orders, order_items, order_history, deliveries, alerts,
-- delivery_fees, special_delivery_fees, special_delivery_fees_2,
-- delivery_promotions, product_variants, auto_confirmation_logs,
-- meta_integration, meta_pages, google_tokens
-- =====================================================

-- END OF DATA EXPORT
