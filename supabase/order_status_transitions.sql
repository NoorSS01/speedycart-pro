-- Order Status Transition Validation
-- Prevents invalid order status changes to maintain business logic integrity

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- If status hasn't changed, allow the update
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Define valid status transitions
    -- Normal flow: pending → confirmed → out_for_delivery → delivered
    -- Can cancel from any status except delivered
    
    CASE OLD.status
        WHEN 'pending' THEN
            -- From pending: can go to confirmed or cancelled
            valid_transition := NEW.status IN ('confirmed', 'cancelled');
            
        WHEN 'confirmed' THEN
            -- From confirmed: can go to out_for_delivery or cancelled
            valid_transition := NEW.status IN ('out_for_delivery', 'cancelled');
            
        WHEN 'out_for_delivery' THEN
            -- From out_for_delivery: can go to delivered or cancelled
            valid_transition := NEW.status IN ('delivered', 'cancelled');
            
        WHEN 'delivered' THEN
            -- From delivered: cannot change status (terminal state)
            valid_transition := FALSE;
            
        WHEN 'cancelled' THEN
            -- From cancelled: cannot change status (terminal state)
            valid_transition := FALSE;
            
        ELSE
            -- Unknown status - reject
            valid_transition := FALSE;
    END CASE;

    -- If transition is invalid, raise an error
    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status
            USING HINT = 'Valid transitions: pending→confirmed→out_for_delivery→delivered, or cancel from any non-terminal status';
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger to enforce status transitions
DROP TRIGGER IF EXISTS enforce_order_status_transition ON orders;
CREATE TRIGGER enforce_order_status_transition
    BEFORE UPDATE ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_order_status_transition();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_order_status_transition() TO authenticated;
