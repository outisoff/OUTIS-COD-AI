-- Update existing delivery situations to show only the vote option
UPDATE deliveries 
SET delivery_situation = regexp_replace(delivery_situation, '^.*:\s*', '')
WHERE carrier LIKE 'local:%' AND delivery_situation IS NOT NULL;