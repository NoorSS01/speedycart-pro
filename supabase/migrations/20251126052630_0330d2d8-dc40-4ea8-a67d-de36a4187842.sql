-- Fix infinite recursion in orders RLS by using security definer functions

-- Function to check if user is delivery person for a specific order
CREATE OR REPLACE FUNCTION public.is_delivery_person_for_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM delivery_assignments
    WHERE order_id = _order_id 
      AND delivery_person_id = _user_id
  )
$$;

-- Drop and recreate the problematic policy for delivery persons
DROP POLICY IF EXISTS "Delivery persons can view assigned orders" ON orders;

CREATE POLICY "Delivery persons can view assigned orders"
ON orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delivery'::app_role) 
  AND is_delivery_person_for_order(auth.uid(), id)
);

-- Allow admins to update orders
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

CREATE POLICY "Admins can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow system to update orders (for delivery workflow)
DROP POLICY IF EXISTS "System can update orders" ON orders;

CREATE POLICY "System can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins to delete orders
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

CREATE POLICY "Admins can delete orders"
ON orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow admins to manage delivery assignments
DROP POLICY IF EXISTS "Admins can insert assignments" ON delivery_assignments;

CREATE POLICY "Admins can insert assignments"
ON delivery_assignments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow admins to delete user roles
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

CREATE POLICY "Admins can delete roles"
ON user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Ensure products can be properly managed
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Admins can delete products"
ON products
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));