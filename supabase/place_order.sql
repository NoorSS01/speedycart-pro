-- Atomic order placement function
-- Prevents race conditions by validating stock and placing order in single transaction
-- This function is called via RPC from the frontend
-- 
-- ENHANCED: Now collects ALL stock conflicts before failing, allowing UI to show
-- which items need attention and offer resolution options (adjust/remove)

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
  v_variant_name TEXT;
  v_is_active BOOLEAN;
  -- Enhanced: Collect all conflicts instead of failing on first
  v_conflicts JSONB := '[]'::jsonb;
  v_has_conflicts BOOLEAN := false;
  -- Track validated items for order creation
  v_validated_items JSONB := '[]'::jsonb;
BEGIN
  -- ============================================================================
  -- INPUT VALIDATION
  -- ============================================================================
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required', 'error_code', 'INVALID_USER');
  END IF;

  IF p_delivery_address IS NULL OR TRIM(p_delivery_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery address is required', 'error_code', 'INVALID_ADDRESS');
  END IF;

  IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cart is empty', 'error_code', 'EMPTY_CART');
  END IF;

  -- ============================================================================
  -- STOCK VALIDATION WITH ROW LOCKING
  -- Collect ALL conflicts before failing to provide complete feedback to UI
  -- ============================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    
    -- Reset variant name for each iteration
    v_variant_name := NULL;

    -- Validate quantity
    IF v_quantity IS NULL OR v_quantity < 1 THEN
      v_conflicts := v_conflicts || jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_variant_id,
        'product_name', 'Unknown',
        'requested', v_quantity,
        'available', 0,
        'conflict_type', 'invalid_quantity'
      );
      v_has_conflicts := true;
      CONTINUE;
    END IF;

    -- Lock the product row and check stock (FOR UPDATE prevents concurrent modifications)
    SELECT stock_quantity, name, price, is_active 
    INTO v_stock, v_product_name, v_price, v_is_active
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    -- Product not found
    IF v_stock IS NULL THEN
      v_conflicts := v_conflicts || jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_variant_id,
        'product_name', 'Product not found',
        'requested', v_quantity,
        'available', 0,
        'conflict_type', 'not_found'
      );
      v_has_conflicts := true;
      CONTINUE;
    END IF;

    -- Product inactive
    IF NOT v_is_active THEN
      v_conflicts := v_conflicts || jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_variant_id,
        'product_name', v_product_name,
        'requested', v_quantity,
        'available', 0,
        'conflict_type', 'product_inactive'
      );
      v_has_conflicts := true;
      CONTINUE;
    END IF;

    -- If variant is specified, get variant info and price
    IF v_variant_id IS NOT NULL THEN
      SELECT pv.price, pv.variant_name INTO v_price, v_variant_name
      FROM product_variants pv
      WHERE pv.id = v_variant_id AND pv.product_id = v_product_id;
      
      IF v_price IS NULL THEN
        v_conflicts := v_conflicts || jsonb_build_object(
          'product_id', v_product_id,
          'variant_id', v_variant_id,
          'product_name', v_product_name,
          'variant_name', 'Variant not found',
          'requested', v_quantity,
          'available', 0,
          'conflict_type', 'variant_not_found'
        );
        v_has_conflicts := true;
        CONTINUE;
      END IF;
    END IF;

    -- Check stock availability
    IF v_stock < v_quantity THEN
      v_conflicts := v_conflicts || jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_variant_id,
        'product_name', v_product_name,
        'variant_name', v_variant_name,
        'requested', v_quantity,
        'available', v_stock,
        'conflict_type', CASE WHEN v_stock = 0 THEN 'out_of_stock' ELSE 'insufficient_stock' END
      );
      v_has_conflicts := true;
      CONTINUE;
    END IF;

    -- Item is valid - add to validated items and running total
    v_total := v_total + (v_price * v_quantity);
    v_validated_items := v_validated_items || jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'quantity', v_quantity,
      'price', v_price,
      'product_name', v_product_name
    );
  END LOOP;

  -- ============================================================================
  -- RETURN CONFLICT DETAILS IF ANY ISSUES FOUND
  -- ============================================================================
  IF v_has_conflicts THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Some items have stock issues',
      'error_code', 'STOCK_CONFLICT',
      'conflict_items', v_conflicts,
      'conflict_count', jsonb_array_length(v_conflicts)
    );
  END IF;

  -- ============================================================================
  -- APPLY COUPON DISCOUNT
  -- ============================================================================
  IF p_coupon_discount > 0 THEN
    v_total := v_total - p_coupon_discount;
    IF v_total < 0 THEN
      v_total := 0;
    END IF;
  END IF;

  -- ============================================================================
  -- CREATE ORDER
  -- ============================================================================
  INSERT INTO orders (user_id, total_amount, delivery_address, status)
  VALUES (p_user_id, v_total, p_delivery_address, 'pending')
  RETURNING id INTO v_order_id;

  -- Create order items (trigger will handle stock reduction)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_validated_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);

    INSERT INTO order_items (order_id, product_id, quantity, price, variant_id)
    VALUES (v_order_id, v_product_id, v_quantity, v_price, v_variant_id);
  END LOOP;

  -- ============================================================================
  -- RECORD COUPON USAGE
  -- ============================================================================
  IF p_coupon_id IS NOT NULL THEN
    BEGIN
      INSERT INTO coupon_usage (user_id, coupon_id, order_id, used_at)
      VALUES (p_user_id, p_coupon_id, v_order_id, NOW());
    EXCEPTION WHEN unique_violation THEN
      -- Coupon already used by this user - rollback entire transaction
      RAISE EXCEPTION 'Coupon has already been used';
    END;
  END IF;

  -- ============================================================================
  -- CLEAR CART
  -- ============================================================================
  DELETE FROM cart_items WHERE user_id = p_user_id;

  -- ============================================================================
  -- SUCCESS RESPONSE
  -- ============================================================================
  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id,
    'total', v_total,
    'item_count', jsonb_array_length(v_validated_items)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Any error will cause automatic rollback
    RETURN jsonb_build_object(
      'success', false, 
      'error', SQLERRM,
      'error_code', 'SYSTEM_ERROR'
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION place_order_atomic(UUID, TEXT, JSONB, UUID, DECIMAL) TO authenticated;
