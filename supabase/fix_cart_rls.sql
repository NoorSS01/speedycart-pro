-- =====================================================
-- FIX: Cart Items RLS Policy for INSERT
-- =====================================================
-- 
-- PROBLEM: FOR ALL USING(...) policy doesn't cover INSERT in PostgreSQL
-- The current policy only works for SELECT, UPDATE, DELETE.
-- INSERT requires WITH CHECK clause.
--
-- RUN THIS SQL IN YOUR SUPABASE SQL EDITOR
-- =====================================================

-- Add explicit INSERT policy for cart_items
-- This allows authenticated users to insert items into THEIR OWN cart
CREATE POLICY "Users can insert to their own cart" 
ON cart_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Also update the FOR ALL policy to include WITH CHECK for completeness
-- First, drop and recreate with both USING and WITH CHECK
DROP POLICY IF EXISTS "Users can manage their own cart" ON cart_items;

CREATE POLICY "Users can manage their own cart" 
ON cart_items 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- VERIFICATION: Test cart insert
-- =====================================================
-- After running, test by:
-- 1. Sign in to the app
-- 2. Click ADD on any product
-- 3. Cart count should update
-- 4. Check browser console for errors
