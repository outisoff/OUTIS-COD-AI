
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  movement_type stock_movement_type;
BEGIN
  -- When order moves to "preparing" status, reserve stock
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT * INTO product FROM products WHERE id = item.product_id;
        IF product.id IS NOT NULL THEN
          -- Reserve stock: decrease current_stock, increase reserved_stock
          UPDATE products
          SET 
            current_stock = current_stock - item.quantity,
            reserved_stock = reserved_stock + item.quantity,
            updated_at = now()
          WHERE id = item.product_id;
          
          -- Log the movement
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, 
            reason, reference, created_by
          ) VALUES (
            item.product_id,
            'exit',
            item.quantity,
            product.current_stock,
            product.current_stock - item.quantity,
            'Réservation pour commande en préparation',
            NEW.order_number,
            auth.uid()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (reduce reserved stock)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT * INTO product FROM products WHERE id = item.product_id;
        IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
          -- Finalize: just decrease reserved_stock (current_stock already reduced)
          UPDATE products
          SET 
            reserved_stock = reserved_stock - item.quantity,
            updated_at = now()
          WHERE id = item.product_id;
          
          -- Log as sale
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, 
            reason, reference, created_by
          ) VALUES (
            item.product_id,
            'sale',
            item.quantity,
            product.current_stock,
            product.current_stock,
            'Vente finalisée - Commande livrée',
            NEW.order_number,
            auth.uid()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock from reserved to available
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Only restore if it was previously reserved (was in preparing or beyond)
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: increase current_stock, decrease reserved_stock
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Log as return
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id,
              'return',
              item.quantity,
              product.current_stock,
              product.current_stock + item.quantity,
              'Annulation commande',
              NEW.order_number,
              auth.uid()
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (non-delivered order coming back), restore reserved to available
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    -- Only restore if it was previously reserved (was in preparing, ready, at_station, or shipped)
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: move from reserved back to available
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Log as return
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id,
              'return',
              item.quantity,
              product.current_stock,
              product.current_stock + item.quantity,
              'Retour commande non livrée',
              NEW.order_number,
              auth.uid()
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
