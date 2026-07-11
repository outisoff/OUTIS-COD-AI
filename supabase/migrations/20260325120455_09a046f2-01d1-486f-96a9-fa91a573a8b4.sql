-- Delete the duplicate 9-digit entry where a 10-digit version already exists
DELETE FROM customers 
WHERE id IN (
  SELECT c1.id 
  FROM customers c1
  JOIN customers c2 ON '0' || c1.phone = c2.phone
  WHERE length(c1.phone) = 9
);

-- Now safely prefix all remaining 9-digit phones with '0'
UPDATE customers SET phone = '0' || phone WHERE length(phone) = 9 AND phone NOT LIKE '0%';