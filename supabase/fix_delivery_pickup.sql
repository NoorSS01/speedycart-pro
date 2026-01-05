-- Fix: Allow delivery partners to update orders
-- Run this in Supabase SQL Editor

-- Drop the old policy
DROP POLICY IF EXISTS "System can update orders" ON orders;

-- Create new policy with proper WITH CHECK clause
CREATE POLICY "System can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
