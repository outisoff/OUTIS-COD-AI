-- Backfill delivery records for existing local livreur orders with poll votes
INSERT INTO deliveries (order_id, carrier, delivery_status, delivery_situation, last_update)
VALUES
  ('4c17aaa2-9668-4051-b3cb-4687ea2ba35b', 'local:Mouh', 'alerte', '🚚 Mouh: Réporter', now()),
  ('bea3289d-7570-466d-88d2-26b3ef174b6c', 'local:Mouh', 'delivered', '🚚 Mouh: Livré', now()),
  ('9f1ad07c-052b-40f4-84a4-b358e5865b29', 'local:Mouh', 'Échec_de_livraison', '👑 Admin: Retour', now()),
  ('ca822f6c-91ed-4ded-9966-aaec7ea6db38', 'local:Mouh', 'delivered', '👑 Admin: Livré', now()),
  ('2cfa975c-745c-4520-be04-bfe9d4336620', 'local:Mouh', 'delivered', '👑 Admin: Livré', now())
ON CONFLICT DO NOTHING;