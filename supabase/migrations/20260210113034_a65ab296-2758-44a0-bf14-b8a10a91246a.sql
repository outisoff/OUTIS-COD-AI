
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
BEGIN

  -- ============================================================
  -- STEP 0: REVERSE SALE when leaving delivered/delivered_paid
  -- If order was delivered and goes back to ANY other status,
  -- undo the sale (re-reserve stock) so downstream handlers work
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
            -- Re-reserve the stock (undo the sale)
            UPDATE products
            SET 
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Record re-reservation as 'exit' so idempotency checks work
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock,
              'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid()
            );
            
            -- Remove sale record so it can be re-finalized later
            DELETE FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 1: RESERVE stock when entering "preparing" (IDEMPOTENT)
  -- ============================================================
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
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

  -- ============================================================
  -- STEP 2: RESTORE when going back to confirmed (IDEMPOTENT)
  -- Expanded to cover ALL possible previous statuses
  -- ============================================================
  IF NEW.status = 'confirmed' AND OLD.status IN (
    'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 
    'shipped', 'Échec_de_livraison', 'exchange', 'erreur',
    'delivered', 'delivered_paid'
  ) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
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
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 3: FINALIZE SALE when delivered (IDEMPOTENT)
  -- ============================================================
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

  -- ============================================================
  -- STEP 4: RESTORE on CANCEL (IDEMPOTENT)
  -- Expanded to cover all reserved-phase statuses + delivered
  -- ============================================================
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN (
      'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
      'shipped', 'Échec_de_livraison', 'exchange',
      'delivered', 'delivered_paid'
    ) THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
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

  -- ============================================================
  -- STEP 5: RESTORE on RETURN (IDEMPOTENT)
  -- Expanded to cover all reserved-phase statuses + delivered
  -- ============================================================
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN (
      'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
      'shipped', 'Échec_de_livraison', 'exchange',
      'delivered', 'delivered_paid'
    ) THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
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

  -- ============================================================
  -- STEP 6: RESTORE on ERREUR (IDEMPOTENT) - NEW
  -- ============================================================
  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF OLD.status IN (
      'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
      'shipped', 'Échec_de_livraison', 'exchange',
      'delivered', 'delivered_paid'
    ) THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
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
                product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
