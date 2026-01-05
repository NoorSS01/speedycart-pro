-- ============================================
-- FIX: Allow delivery partners to pick up orders
-- Run this in Supabase SQL Editor
-- ============================================

-- Replace the order status transition function
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Validate transitions
  CASE OLD.status
    WHEN 'pending' THEN
      -- Allow: confirmed, out_for_delivery, cancelled, rejected
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
      NULL;
  END CASE;
  
  RETURN NEW;
END;
$$;
