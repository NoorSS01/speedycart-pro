-- =====================================================
-- PREMAS SHOP - PRODUCTION PUSH NOTIFICATION SYSTEM
-- Complete schema for Zepto/Blinkit-like notifications
-- =====================================================

-- Drop existing tables if upgrading
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS broadcast_notifications CASCADE;
DROP TABLE IF EXISTS notification_templates CASCADE;

-- =====================================================
-- 1. NOTIFICATION TEMPLATES
-- Pre-defined templates for different notification types
-- =====================================================
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'order_status', 'profit_summary', 'low_stock', 'daily_reminder', 'broadcast'
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  icon TEXT DEFAULT 'bell',
  default_url TEXT DEFAULT '/dist/',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO notification_templates (name, type, title_template, body_template, icon, default_url) VALUES
  ('order_placed', 'order_status', '🛒 New Order #{{order_id}}', 'New order worth ₹{{amount}} received! Customer: {{customer_name}}', 'shopping-cart', '/dist/admin'),
  ('order_confirmed', 'order_status', '✅ Order Confirmed #{{order_id}}', 'Order #{{order_id}} has been confirmed. Amount: ₹{{amount}}', 'check-circle', '/dist/orders'),
  ('order_packed', 'order_status', '📦 Order Packed #{{order_id}}', 'Your order #{{order_id}} is packed and ready for delivery!', 'package', '/dist/orders'),
  ('order_out_for_delivery', 'order_status', '🚴 Out for Delivery #{{order_id}}', 'Your order #{{order_id}} is on the way! ETA: {{eta}} mins', 'truck', '/dist/orders'),
  ('order_delivered', 'order_status', '🎉 Order Delivered #{{order_id}}', 'Your order #{{order_id}} has been delivered. Thank you!', 'check', '/dist/orders'),
  ('order_cancelled', 'order_status', '❌ Order Cancelled #{{order_id}}', 'Order #{{order_id}} has been cancelled. Refund initiated.', 'x-circle', '/dist/orders'),
  ('delivery_delayed', 'order_status', '⏰ Delivery Delayed #{{order_id}}', 'Sorry! Order #{{order_id}} is delayed. New ETA: {{eta}} mins', 'clock', '/dist/orders'),
  ('low_stock_alert', 'low_stock', '⚠️ Low Stock Alert', '{{product_name}} is running low! Only {{quantity}} left.', 'alert-triangle', '/dist/admin/stock'),
  ('out_of_stock', 'low_stock', '🚨 Out of Stock!', '{{product_name}} is now OUT OF STOCK!', 'alert-circle', '/dist/admin/stock'),
  ('daily_profit_summary', 'profit_summary', '💰 Daily Profit Summary', 'Today: ₹{{revenue}} revenue, ₹{{profit}} profit from {{order_count}} orders!', 'trending-up', '/dist/admin'),
  ('daily_reminder', 'daily_reminder', '☀️ Good {{time_of_day}}!', 'Time to check your shop! {{pending_orders}} pending orders waiting.', 'sun', '/dist/admin'),
  ('welcome_notification', 'broadcast', '👋 Welcome to PremasShop!', 'Thanks for installing! Get fresh groceries delivered in minutes.', 'heart', '/dist/shop'),
  ('flash_sale', 'broadcast', '⚡ Flash Sale Live!', '{{message}}', 'zap', '/dist/shop'),
  ('new_product', 'broadcast', '🆕 New Arrival!', '{{product_name}} is now available. Order now!', 'sparkles', '/dist/shop');

-- =====================================================
-- 2. BROADCAST NOTIFICATIONS
-- Admin-created notifications for mass sending
-- =====================================================
CREATE TABLE broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT DEFAULT 'bell',
  url TEXT DEFAULT '/dist/',
  image_url TEXT,
  
  -- Targeting
  target_audience TEXT NOT NULL DEFAULT 'all', -- 'all', 'users', 'admins', 'delivery', 'specific'
  target_user_ids UUID[] DEFAULT '{}',
  
  -- Scheduling
  send_immediately BOOLEAN DEFAULT true,
  scheduled_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed', 'cancelled'
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  -- Actions
  action_buttons JSONB DEFAULT '[]' -- [{"action": "view", "title": "View Now"}]
);

-- =====================================================
-- 3. NOTIFICATION LOGS
-- Track all sent notifications
-- =====================================================
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT,
  url TEXT,
  image_url TEXT,
  
  -- Classification
  notification_type TEXT NOT NULL, -- 'order_status', 'low_stock', 'profit_summary', 'daily_reminder', 'broadcast'
  reference_type TEXT, -- 'order', 'product', 'broadcast'
  reference_id TEXT, -- order_id, product_id, broadcast_id
  
  -- Delivery status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'clicked', 'failed'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  -- Broadcast reference
  broadcast_id UUID REFERENCES broadcast_notifications(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_status ON broadcast_notifications(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_scheduled ON broadcast_notifications(scheduled_at) WHERE status = 'pending';

-- =====================================================
-- 4. UPDATE PUSH_SUBSCRIPTIONS TABLE
-- Add more preference fields
-- =====================================================
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS new_order_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_updates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS promotional_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vibration_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_count INTEGER DEFAULT 0;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Notification Templates (read-only for all, admin can modify)
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification templates" 
  ON notification_templates FOR SELECT USING (true);

CREATE POLICY "Admins can manage notification templates" 
  ON notification_templates FOR ALL 
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Broadcast Notifications
ALTER TABLE broadcast_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all broadcasts" 
  ON broadcast_notifications FOR SELECT 
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can create broadcasts" 
  ON broadcast_notifications FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update broadcasts" 
  ON broadcast_notifications FOR UPDATE 
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Notification Logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs" 
  ON notification_logs FOR SELECT 
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- =====================================================
-- 6. DATABASE TRIGGERS FOR AUTOMATED NOTIFICATIONS
-- =====================================================

-- Function to check low stock and create notification
CREATE OR REPLACE FUNCTION check_low_stock_notification()
RETURNS TRIGGER AS $$
DECLARE
  low_stock_threshold INTEGER := 5;
  critical_stock_threshold INTEGER := 2;
BEGIN
  -- Check if stock just went below threshold
  IF NEW.stock_quantity <= critical_stock_threshold AND OLD.stock_quantity > critical_stock_threshold THEN
    -- Insert into notification queue (will be processed by Edge Function)
    INSERT INTO notification_logs (
      notification_type, 
      reference_type, 
      reference_id, 
      title, 
      body, 
      url, 
      status
    ) VALUES (
      'low_stock',
      'product',
      NEW.id::TEXT,
      '🚨 Critical Stock: ' || NEW.name,
      NEW.name || ' has only ' || NEW.stock_quantity || ' units left! Restock immediately.',
      '/dist/admin/stock',
      'pending'
    );
  ELSIF NEW.stock_quantity <= low_stock_threshold AND OLD.stock_quantity > low_stock_threshold THEN
    INSERT INTO notification_logs (
      notification_type, 
      reference_type, 
      reference_id, 
      title, 
      body, 
      url, 
      status
    ) VALUES (
      'low_stock',
      'product',
      NEW.id::TEXT,
      '⚠️ Low Stock: ' || NEW.name,
      NEW.name || ' is running low! Only ' || NEW.stock_quantity || ' units remaining.',
      '/dist/admin/stock',
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for low stock
DROP TRIGGER IF EXISTS trigger_low_stock_notification ON products;
CREATE TRIGGER trigger_low_stock_notification
  AFTER UPDATE OF stock_quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock_notification();

-- Function to create order status notification
CREATE OR REPLACE FUNCTION create_order_notification()
RETURNS TRIGGER AS $$
DECLARE
  customer_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
  notification_url TEXT;
BEGIN
  -- Get customer name
  SELECT COALESCE(p.full_name, 'Customer') INTO customer_name
  FROM profiles p WHERE p.id = NEW.user_id;
  
  -- Determine notification content based on status
  CASE NEW.status
    WHEN 'pending' THEN
      notification_title := '🛒 New Order #' || LEFT(NEW.id::TEXT, 8);
      notification_body := 'New order worth ₹' || NEW.total_amount || ' from ' || customer_name;
      notification_url := '/dist/admin';
    WHEN 'confirmed' THEN
      notification_title := '✅ Order Confirmed #' || LEFT(NEW.id::TEXT, 8);
      notification_body := 'Your order has been confirmed! Preparing now...';
      notification_url := '/dist/orders';
    WHEN 'out_for_delivery' THEN
      notification_title := '🚴 On the Way! #' || LEFT(NEW.id::TEXT, 8);
      notification_body := 'Your order is out for delivery. Arriving soon!';
      notification_url := '/dist/orders';
    WHEN 'delivered' THEN
      notification_title := '🎉 Delivered! #' || LEFT(NEW.id::TEXT, 8);
      notification_body := 'Your order has been delivered. Thank you for shopping!';
      notification_url := '/dist/orders';
    WHEN 'cancelled' THEN
      notification_title := '❌ Order Cancelled #' || LEFT(NEW.id::TEXT, 8);
      notification_body := 'Order has been cancelled. Refund will be processed.';
      notification_url := '/dist/orders';
    WHEN 'rejected' THEN
      notification_title := '❌ Order Rejected #' || LEFT(NEW.id::TEXT, 8);
      notification_body := 'Sorry, your order could not be processed.';
      notification_url := '/dist/orders';
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Create notification log for customer (for status updates after pending)
  IF NEW.status != 'pending' THEN
    INSERT INTO notification_logs (
      user_id,
      notification_type, 
      reference_type, 
      reference_id, 
      title, 
      body, 
      url, 
      status
    ) VALUES (
      NEW.user_id,
      'order_status',
      'order',
      NEW.id::TEXT,
      notification_title,
      notification_body,
      notification_url,
      'pending'
    );
  END IF;
  
  -- Create notification for admin (for new orders)
  IF NEW.status = 'pending' THEN
    INSERT INTO notification_logs (
      notification_type, 
      reference_type, 
      reference_id, 
      title, 
      body, 
      url, 
      status
    ) VALUES (
      'order_status',
      'order',
      NEW.id::TEXT,
      notification_title,
      notification_body,
      notification_url,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for order notifications
DROP TRIGGER IF EXISTS trigger_order_notification ON orders;
CREATE TRIGGER trigger_order_notification
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_notification();

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to get admin user IDs
CREATE OR REPLACE FUNCTION get_admin_user_ids()
RETURNS UUID[] AS $$
DECLARE
  admin_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT user_id) INTO admin_ids
  FROM user_roles
  WHERE role IN ('admin', 'super_admin');
  
  RETURN COALESCE(admin_ids, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get delivery user IDs
CREATE OR REPLACE FUNCTION get_delivery_user_ids()
RETURNS UUID[] AS $$
DECLARE
  delivery_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT user_id) INTO delivery_ids
  FROM user_roles
  WHERE role = 'delivery';
  
  RETURN COALESCE(delivery_ids, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users with specific notification preference
CREATE OR REPLACE FUNCTION get_users_with_preference(pref_column TEXT, pref_value BOOLEAN DEFAULT true)
RETURNS TABLE(user_id UUID, endpoint TEXT, p256dh TEXT, auth TEXT) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT ps.user_id, ps.endpoint, ps.p256dh, ps.auth 
     FROM push_subscriptions ps 
     WHERE ps.%I = $1',
    pref_column
  ) USING pref_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_admin_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_delivery_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_preference(TEXT, BOOLEAN) TO authenticated;

-- =====================================================
-- 8. VIEW FOR NOTIFICATION STATISTICS
-- =====================================================
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
  notification_type,
  status,
  COUNT(*) as count,
  DATE(created_at) as date
FROM notification_logs
GROUP BY notification_type, status, DATE(created_at)
ORDER BY date DESC, notification_type;

-- Grant access to admins
GRANT SELECT ON notification_stats TO authenticated;
