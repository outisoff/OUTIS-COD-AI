-- Add handling for orders going back to confirmed status (restore stock)
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'exit'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order goes BACK to confirmed from preparation stages, restore stock
  IF NEW.status = 'confirmed' AND OLD.status IN ('preparing', 'ready', 'at_station') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        -- Check if exit movement exists (stock was reserved)
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'exit'
        ) AND NOT EXISTS (
          -- And no return already recorded for this rollback
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'return'
            AND reason = 'Retour au statut confirmé'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: move from reserved back to available
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'return'
          ) THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'return'
          ) THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;