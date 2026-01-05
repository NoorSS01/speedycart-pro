-- ===============================================
-- Order Total Validation (Product Integrity Fix PI-001)
-- Prevents client-side manipulation of order totals
-- ===============================================

-- Function to calculate the correct order total from order_items
CREATE OR REPLACE FUNCTION calculate_order_total(_order_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_total DECIMAL(10, 2);
BEGIN
  SELECT COALESCE(SUM(price * quantity), 0)
  INTO calculated_total
  FROM order_items
  WHERE order_id = _order_id;
  
  RETURN calculated_total;
END;
$$;

-- Trigger function to validate and auto-correct order total on update
-- This runs AFTER order_items are inserted
CREATE OR REPLACE FUNCTION validate_order_total_after_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_total DECIMAL(10, 2);
  current_total DECIMAL(10, 2);
BEGIN
  -- Calculate the correct total from order_items
  SELECT COALESCE(SUM(price * quantity), 0)
  INTO calculated_total
  FROM order_items
  WHERE order_id = NEW.order_id;
  
  -- Get current order total
  SELECT total_amount INTO current_total
  FROM orders WHERE id = NEW.order_id;
  
  -- If there's a mismatch greater than ₹1 (for rounding), log and correct
  IF ABS(current_total - calculated_total) > 1 THEN
    -- Log potential fraud attempt
    INSERT INTO malicious_activities (
      order_id,
      user_id,
      activity_type,
      description
    )
    SELECT 
      NEW.order_id,
      orders.user_id,
      'price_manipulation',
      'Order total mismatch detected. Client sent: ₹' || current_total || ', Calculated: ₹' || calculated_total
    FROM orders WHERE id = NEW.order_id;
    
    -- Auto-correct the order total
    UPDATE orders
    SET total_amount = calculated_total,
        updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate total after all order items are inserted
DROP TRIGGER IF EXISTS trigger_validate_order_total ON order_items;
CREATE TRIGGER trigger_validate_order_total
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION validate_order_total_after_items();

-- ===============================================
-- Order Status Transition Validation (PI-003)
-- Enforces valid status flow
-- ===============================================

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Define valid transitions
  -- pending -> confirmed, cancelled
  -- confirmed -> out_for_delivery, cancelled
  -- out_for_delivery -> delivered, cancelled
  -- delivered -> (no transitions allowed)
  -- cancelled -> (no transitions allowed)
  
  -- Skip if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Validate transitions
  CASE OLD.status
    WHEN 'pending' THEN
      IF NEW.status NOT IN ('confirmed', 'out_for_delivery', 'cancelled', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
      END IF;
    WHEN 'confirmed' THEN
      IF NEW.status NOT IN ('out_for_delivery', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from confirmed to %', NEW.status;
      END IF;
    WHEN 'out_for_delivery' THEN
      IF NEW.status NOT IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from out_for_delivery to %', NEW.status;
      END IF;
    WHEN 'delivered' THEN
      RAISE EXCEPTION 'Cannot change status of delivered orders';
    WHEN 'cancelled' THEN
      RAISE EXCEPTION 'Cannot change status of cancelled orders';
    WHEN 'rejected' THEN
      RAISE EXCEPTION 'Cannot change status of rejected orders';
    ELSE
      -- Allow for unknown statuses (backwards compatibility)
      NULL;
  END CASE;
  
  RETURN NEW;
END;
$$;

-- Create trigger for status validation
DROP TRIGGER IF EXISTS trigger_validate_order_status ON orders;
CREATE TRIGGER trigger_validate_order_status
BEFORE UPDATE ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION validate_order_status_transition();
