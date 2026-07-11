
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
  is_new_reserve BOOLEAN;
  was_old_reserve BOOLEAN;
BEGIN
  -- Determine if new/old status is a reserve status
  is_new_reserve := NEW.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'shipped', 'Échec_de_livraison', 'exchange');
  was_old_reserve := OLD.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'shipped', 'Échec_de_livraison', 'exchange');

  -- ============================================================
  -- STEP 0: REVERSE SALE when leaving delivered/delivered_paid
  -- ============================================================
  IF OLD.status IN ('delivered', 'delivered_paid') AND NEW.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock, 'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid());
            DELETE FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 1: RESERVE stock when entering any reserve status (IDEMPOTENT)
  -- ============================================================
  IF is_new_reserve AND NOT was_old_reserve THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock - item.quantity, reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock - item.quantity, 'Réservation pour commande', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 2: RESTORE when going back to confirmed
  -- ============================================================
  IF NEW.status = 'confirmed' AND (was_old_reserve OR OLD.status IN ('erreur', 'delivered', 'delivered_paid')) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour au statut confirmé', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 3: FINALIZE SALE when delivered
  -- ============================================================
  IF NEW.status IN ('delivered', 'delivered_paid') AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale') THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products SET reserved_stock = reserved_stock - item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'sale', item.quantity, product.current_stock, product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 4: RESTORE on CANCEL
  -- ============================================================
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 5: RESTORE on RETURN
  -- ============================================================
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 6: RESTORE on ERREUR
  -- ============================================================
  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
