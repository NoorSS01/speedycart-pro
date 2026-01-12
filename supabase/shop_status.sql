-- =====================================================
-- Shop Status & Order Assignment Improvements
-- =====================================================
-- 
-- RUN THIS SQL IN YOUR SUPABASE SQL EDITOR
-- =====================================================

-- 1. Add shop_status column to admin_settings
-- 'open' = accept orders (delivery assignment when available)
-- 'closed' = reject orders, show "Shop is closed" message
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS shop_status TEXT DEFAULT 'open' CHECK (shop_status IN ('open', 'closed'));

-- 2. Add closed_message for custom message when shop is closed
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS closed_message TEXT DEFAULT 'We are currently closed. Please try again later.';

-- 3. Add scheduling columns for automatic open/close
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS scheduled_open_time TIME DEFAULT '08:00:00';

ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS scheduled_close_time TIME DEFAULT '22:00:00';

-- 4. Add flag to enable/disable auto-scheduling
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN DEFAULT false;

-- =====================================================
-- Function: Assign pending orders when delivery activates
-- Called when a delivery partner's activation is approved
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_pending_orders_to_partner(partner_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assigned_count INTEGER := 0;
    v_order RECORD;
    v_max_orders INTEGER := 5; -- Max orders per partner at once
BEGIN
    -- Find pending orders with no delivery assignment
    FOR v_order IN 
        SELECT o.id
        FROM orders o
        LEFT JOIN delivery_assignments da ON da.order_id = o.id
        WHERE o.status = 'pending'
          AND da.id IS NULL
        ORDER BY o.created_at ASC
        LIMIT v_max_orders
    LOOP
        -- Assign the order to this partner
        INSERT INTO delivery_assignments (order_id, delivery_person_id, status)
        VALUES (v_order.id, partner_id, 'assigned')
        ON CONFLICT (order_id) DO NOTHING;
        
        v_assigned_count := v_assigned_count + 1;
    END LOOP;
    
    RETURN v_assigned_count;
END;
$$;

-- =====================================================
-- Trigger: Auto-assign pending orders when partner activates
-- =====================================================
CREATE OR REPLACE FUNCTION public.on_delivery_activation_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assigned INTEGER;
BEGIN
    -- Only act when status changes to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Assign pending orders to this partner
        SELECT assign_pending_orders_to_partner(NEW.delivery_partner_id) INTO v_assigned;
        
        -- Log it
        IF v_assigned > 0 THEN
            RAISE NOTICE 'Assigned % pending orders to partner %', v_assigned, NEW.delivery_partner_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_on_delivery_activation_approved ON delivery_activations;

-- Create trigger on delivery_activations table
CREATE TRIGGER trigger_on_delivery_activation_approved
AFTER INSERT OR UPDATE ON delivery_activations
FOR EACH ROW
EXECUTE FUNCTION public.on_delivery_activation_approved();

-- =====================================================
-- Helper function to check if shop is open
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_shop_open()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT shop_status = 'open' FROM admin_settings WHERE id = '00000000-0000-0000-0000-000000000001'),
        true
    );
$$;

-- =====================================================
-- Helper function to get shop closed message
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_shop_closed_message()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT closed_message FROM admin_settings WHERE id = '00000000-0000-0000-0000-000000000001'),
        'We are currently closed. Please try again later.'
    );
$$;

-- =====================================================
-- Update admin_settings RLS to allow admin to update shop_status
-- =====================================================
DROP POLICY IF EXISTS "Admin can update shop status" ON admin_settings;
CREATE POLICY "Admin can update shop status" 
ON admin_settings FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- =====================================================
-- Success
-- =====================================================
SELECT 'Shop status and order assignment improvements created!' as status;
