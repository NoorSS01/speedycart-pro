-- Atomic order placement function
-- Prevents race conditions by validating stock and placing order in single transaction
-- This function is called via RPC from the frontend

CREATE OR REPLACE FUNCTION place_order_atomic(
  p_user_id UUID,
  p_delivery_address TEXT,
  p_cart_items JSONB,  -- [{product_id, variant_id, quantity, price}]
  p_coupon_id UUID DEFAULT NULL,
  p_coupon_discount DECIMAL DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_stock INTEGER;
  v_total DECIMAL(10,2) := 0;
  v_product_name TEXT;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;

  IF p_delivery_address IS NULL OR TRIM(p_delivery_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery address is required');
  END IF;

  IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cart is empty');
  END IF;

  -- Lock and validate all products atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    -- SECURITY FIX: DO NOT accept client price - fetch from database
    -- v_price := (v_item->>'price')::DECIMAL(10,2);  -- OLD VULNERABLE CODE

    -- Validate quantity
    IF v_quantity IS NULL OR v_quantity < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid quantity for item');
    END IF;

    -- Lock the product row and check stock (FOR UPDATE prevents concurrent modifications)
    SELECT stock_quantity, name, price INTO v_stock, v_product_name, v_price
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_stock IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Product not found: ' || v_product_id);
    END IF;

    -- If variant is specified, use variant price instead
    IF v_variant_id IS NOT NULL THEN
      SELECT price INTO v_price
      FROM product_variants
      WHERE id = v_variant_id AND product_id = v_product_id;
      
      IF v_price IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Variant not found: ' || v_variant_id);
      END IF;
    END IF;

    IF v_stock < v_quantity THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Insufficient stock for %s. Only %s available.', v_product_name, v_stock),
        'product_id', v_product_id
      );
    END IF;

    v_total := v_total + (v_price * v_quantity);
  END LOOP;

  -- Apply coupon discount (already validated by frontend and server)
  IF p_coupon_discount > 0 THEN
    v_total := v_total - p_coupon_discount;
    IF v_total < 0 THEN
      v_total := 0;
    END IF;
  END IF;

  -- Create the order
  INSERT INTO orders (user_id, total_amount, delivery_address, status)
  VALUES (p_user_id, v_total, p_delivery_address, 'pending')
  RETURNING id INTO v_order_id;

  -- Create order items and decrement stock (trigger will handle stock reduction)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- SECURITY FIX: Fetch actual price from database (already fetched in validation loop)
    -- We need to re-fetch to ensure consistency
    SELECT price INTO v_price FROM products WHERE id = v_product_id;
    
    IF v_variant_id IS NOT NULL THEN
      SELECT price INTO v_price FROM product_variants WHERE id = v_variant_id;
    END IF;

    INSERT INTO order_items (order_id, product_id, quantity, price, variant_id)
    VALUES (v_order_id, v_product_id, v_quantity, v_price, v_variant_id);
  END LOOP;

  -- Record coupon usage if applicable
  IF p_coupon_id IS NOT NULL THEN
    BEGIN
      INSERT INTO coupon_usage (user_id, coupon_id, order_id, used_at)
      VALUES (p_user_id, p_coupon_id, v_order_id, NOW());
    EXCEPTION WHEN unique_violation THEN
      -- Coupon already used by this user - rollback entire transaction
      RAISE EXCEPTION 'Coupon has already been used';
    END;
  END IF;

  -- Clear cart items for this user
  DELETE FROM cart_items WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id,
    'total', v_total
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Any error will cause automatic rollback
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION place_order_atomic(UUID, TEXT, JSONB, UUID, DECIMAL) TO authenticated;
