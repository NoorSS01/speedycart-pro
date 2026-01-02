-- ===============================================
-- Admin Lockout Backend Enforcement
-- Run this AFTER admin_lockout.sql
-- ===============================================

-- Function to check if admin is locked
CREATE OR REPLACE FUNCTION is_admin_locked()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_locked FROM admin_settings WHERE id = '00000000-0000-0000-0000-000000000001'),
    FALSE
  );
$$;

-- Function to check if current user is a locked admin
-- Returns TRUE if user is an admin AND the admin panel is locked
-- Super admins are never locked
CREATE OR REPLACE FUNCTION is_current_user_locked_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Super admins are never locked
      WHEN has_role(auth.uid(), 'super_admin'::app_role) THEN FALSE
      -- Check if user is admin AND lockout is active
      WHEN has_role(auth.uid(), 'admin'::app_role) AND is_admin_locked() THEN TRUE
      -- All other users not affected
      ELSE FALSE
    END;
$$;

-- ===============================================
-- RLS Policy Modifications
-- Block locked admins from modifying data
-- ===============================================

-- Products: Locked admins cannot modify products
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
ON products
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

-- Categories: Locked admins cannot modify categories
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
ON categories
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

-- Orders: Locked admins cannot update orders
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

-- Orders: Locked admins cannot delete orders
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders"
ON orders
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

-- Delivery Applications: Locked admins cannot approve/reject
DROP POLICY IF EXISTS "Admins can update all applications" ON delivery_applications;
CREATE POLICY "Admins can update all applications"
ON delivery_applications
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

-- Delivery Assignments: Locked admins cannot manage assignments
DROP POLICY IF EXISTS "Admins can manage all assignments" ON delivery_assignments;
CREATE POLICY "Admins can manage all assignments"
ON delivery_assignments
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

DROP POLICY IF EXISTS "Admins can insert assignments" ON delivery_assignments;
CREATE POLICY "Admins can insert assignments"
ON delivery_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND NOT is_current_user_locked_admin()
);

-- ===============================================
-- READ access is still allowed for locked admins
-- They can VIEW data but not MODIFY it
-- This is intentional - they need to see what they're paying for
-- ===============================================

SELECT 'Admin lockout backend enforcement created!' as status;
SELECT 'Locked admins can VIEW data but cannot INSERT, UPDATE, or DELETE' as note;
