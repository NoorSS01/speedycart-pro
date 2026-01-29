-- ============================================================================
-- Stock Race Condition Handling - Real-time Stock Synchronization
-- ============================================================================
-- This file enables real-time stock updates and provides helper functions
-- for checking stock availability across multiple products atomically.
-- 
-- Run this in Supabase SQL Editor after schema.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: Enable Realtime for Products Table
-- ============================================================================
-- This allows frontend to subscribe to stock_quantity changes
-- Note: Only stock_quantity and is_active changes are relevant for cart validation

-- Add products to realtime publication (idempotent - won't fail if already added)
DO $$
BEGIN
  -- Check if products table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;
END;
$$;


-- ============================================================================
-- SECTION 2: Batch Stock Check Function
-- ============================================================================
-- Efficiently check stock for multiple products in a single query
-- Used by frontend to validate cart before checkout attempt

CREATE OR REPLACE FUNCTION check_stock_batch(p_product_ids UUID[])
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  stock_quantity INTEGER,
  is_active BOOLEAN,
  price DECIMAL(10,2)
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id AS product_id,
    name AS product_name,
    stock_quantity,
    is_active,
    price
  FROM products
  WHERE id = ANY(p_product_ids);
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_stock_batch(UUID[]) TO authenticated;


-- ============================================================================
-- SECTION 3: Check Stock with Variants
-- ============================================================================
-- Extended stock check that includes variant information
-- Used when cart contains items with variants

CREATE OR REPLACE FUNCTION check_stock_with_variants(
  p_items JSONB  -- [{product_id, variant_id, quantity}]
)
RETURNS TABLE(
  product_id UUID,
  variant_id UUID,
  product_name TEXT,
  variant_name TEXT,
  requested_quantity INTEGER,
  available_stock INTEGER,
  is_available BOOLEAN,
  price DECIMAL(10,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_stock INTEGER;
  v_product_name TEXT;
  v_variant_name TEXT;
  v_price DECIMAL(10,2);
  v_is_active BOOLEAN;
BEGIN
  -- Create temp table for results
  CREATE TEMP TABLE IF NOT EXISTS stock_check_results (
    product_id UUID,
    variant_id UUID,
    product_name TEXT,
    variant_name TEXT,
    requested_quantity INTEGER,
    available_stock INTEGER,
    is_available BOOLEAN,
    price DECIMAL(10,2)
  ) ON COMMIT DROP;
  
  -- Clear any existing results
  DELETE FROM stock_check_results;
  
  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    
    -- Get product info
    SELECT name, stock_quantity, is_active, price 
    INTO v_product_name, v_stock, v_is_active, v_price
    FROM products
    WHERE id = v_product_id;
    
    -- If variant specified, get variant info
    IF v_variant_id IS NOT NULL THEN
      SELECT variant_name, price 
      INTO v_variant_name, v_price
      FROM product_variants
      WHERE id = v_variant_id AND product_id = v_product_id;
    ELSE
      v_variant_name := NULL;
    END IF;
    
    -- Insert result
    INSERT INTO stock_check_results VALUES (
      v_product_id,
      v_variant_id,
      COALESCE(v_product_name, 'Unknown Product'),
      v_variant_name,
      v_quantity,
      COALESCE(v_stock, 0),
      COALESCE(v_is_active, false) AND COALESCE(v_stock, 0) >= v_quantity,
      COALESCE(v_price, 0)
    );
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT * FROM stock_check_results;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_stock_with_variants(JSONB) TO authenticated;


-- ============================================================================
-- SECTION 4: Get Cart Stock Status
-- ============================================================================
-- Specifically designed for cart page - returns stock status for all cart items
-- Includes conflict detection and suggested quantities

CREATE OR REPLACE FUNCTION get_cart_stock_status(p_user_id UUID)
RETURNS TABLE(
  cart_item_id UUID,
  product_id UUID,
  variant_id UUID,
  product_name TEXT,
  cart_quantity INTEGER,
  available_stock INTEGER,
  has_conflict BOOLEAN,
  suggested_quantity INTEGER,
  is_out_of_stock BOOLEAN,
  unit_price DECIMAL(10,2)
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ci.id AS cart_item_id,
    ci.product_id,
    ci.variant_id,
    p.name AS product_name,
    ci.quantity AS cart_quantity,
    p.stock_quantity AS available_stock,
    ci.quantity > p.stock_quantity AS has_conflict,
    LEAST(ci.quantity, p.stock_quantity) AS suggested_quantity,
    p.stock_quantity <= 0 OR p.is_active = false AS is_out_of_stock,
    COALESCE(pv.price, p.price) AS unit_price
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  LEFT JOIN product_variants pv ON pv.id = ci.variant_id
  WHERE ci.user_id = p_user_id;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_cart_stock_status(UUID) TO authenticated;


-- ============================================================================
-- SECTION 5: Remove Unavailable Cart Items
-- ============================================================================
-- Removes items from cart that are out of stock or inactive
-- Returns count of removed items

CREATE OR REPLACE FUNCTION remove_unavailable_cart_items(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed_count INTEGER;
  v_removed_items JSONB;
BEGIN
  -- Build list of items being removed (for UI feedback)
  SELECT jsonb_agg(jsonb_build_object(
    'product_id', ci.product_id,
    'product_name', p.name,
    'quantity', ci.quantity
  ))
  INTO v_removed_items
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  WHERE ci.user_id = p_user_id
    AND (p.stock_quantity <= 0 OR p.is_active = false);
  
  -- Remove unavailable items
  DELETE FROM cart_items ci
  USING products p
  WHERE ci.product_id = p.id
    AND ci.user_id = p_user_id
    AND (p.stock_quantity <= 0 OR p.is_active = false);
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'removed_count', v_removed_count,
    'removed_items', COALESCE(v_removed_items, '[]'::jsonb)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION remove_unavailable_cart_items(UUID) TO authenticated;


-- ============================================================================
-- SECTION 6: Adjust Cart to Available Stock
-- ============================================================================
-- Adjusts cart item quantities to match available stock
-- Returns list of adjustments made

CREATE OR REPLACE FUNCTION adjust_cart_to_stock(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjusted_count INTEGER := 0;
  v_removed_count INTEGER := 0;
  v_adjustments JSONB := '[]'::jsonb;
  v_cart_item RECORD;
BEGIN
  -- Process each cart item that needs adjustment
  FOR v_cart_item IN
    SELECT 
      ci.id,
      ci.product_id,
      ci.quantity AS cart_quantity,
      p.name AS product_name,
      p.stock_quantity AS available_stock
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = p_user_id
      AND (ci.quantity > p.stock_quantity OR p.stock_quantity <= 0 OR p.is_active = false)
  LOOP
    IF v_cart_item.available_stock <= 0 THEN
      -- Remove item completely
      DELETE FROM cart_items WHERE id = v_cart_item.id;
      v_removed_count := v_removed_count + 1;
      v_adjustments := v_adjustments || jsonb_build_object(
        'product_id', v_cart_item.product_id,
        'product_name', v_cart_item.product_name,
        'old_quantity', v_cart_item.cart_quantity,
        'new_quantity', 0,
        'action', 'removed'
      );
    ELSE
      -- Adjust quantity to available stock
      UPDATE cart_items 
      SET quantity = v_cart_item.available_stock,
          updated_at = NOW()
      WHERE id = v_cart_item.id;
      v_adjusted_count := v_adjusted_count + 1;
      v_adjustments := v_adjustments || jsonb_build_object(
        'product_id', v_cart_item.product_id,
        'product_name', v_cart_item.product_name,
        'old_quantity', v_cart_item.cart_quantity,
        'new_quantity', v_cart_item.available_stock,
        'action', 'adjusted'
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'adjusted_count', v_adjusted_count,
    'removed_count', v_removed_count,
    'adjustments', v_adjustments
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION adjust_cart_to_stock(UUID) TO authenticated;
