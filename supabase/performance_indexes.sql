-- Performance Indexes for SpeedyCart Pro
-- Run this in Supabase SQL Editor to improve query performance
-- Note: Indexes will briefly lock tables during creation (acceptable for small databases)

-- Products by category (used heavily on Shop page filtering)
CREATE INDEX IF NOT EXISTS idx_products_category_active 
ON products(category_id) WHERE is_active = true;

-- Order items by creation date (used for trending calculations and analytics)
CREATE INDEX IF NOT EXISTS idx_order_items_created_at 
ON order_items(created_at DESC);

-- Cart lookups by user (used on every cart page load and realtime updates)
CREATE INDEX IF NOT EXISTS idx_cart_items_user 
ON cart_items(user_id);

-- User roles lookup (heavily used by RLS policies on every admin/delivery action)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
ON user_roles(user_id, role);

-- Orders by user and status (used on Orders page and admin order management)
CREATE INDEX IF NOT EXISTS idx_orders_user_status
ON orders(user_id, status);

-- Products by active status (used for product listings)
CREATE INDEX IF NOT EXISTS idx_products_active
ON products(is_active) WHERE is_active = true;
