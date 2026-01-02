-- Server-side coupon validation function
-- Prevents discount manipulation by recalculating discount on the server

CREATE OR REPLACE FUNCTION validate_and_apply_coupon(
  p_user_id UUID,
  p_coupon_code TEXT,
  p_subtotal DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount DECIMAL := 0;
  v_already_used BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'User is required');
  END IF;

  IF p_coupon_code IS NULL OR TRIM(p_coupon_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Coupon code is required');
  END IF;

  IF p_subtotal IS NULL OR p_subtotal <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid order subtotal');
  END IF;

  -- Find the coupon (case-insensitive match)
  SELECT * INTO v_coupon
  FROM coupons
  WHERE UPPER(code) = UPPER(TRIM(p_coupon_code))
    AND is_active = true;

  IF v_coupon IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive coupon code');
  END IF;

  -- Check expiry date
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon has expired');
  END IF;

  -- Check minimum order amount
  IF v_coupon.minimum_order IS NOT NULL AND p_subtotal < v_coupon.minimum_order THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'error', format('Minimum order of ₹%s required', v_coupon.minimum_order)
    );
  END IF;

  -- Check if user has already used this coupon (unless stackable)
  IF NOT COALESCE(v_coupon.is_stackable, false) THEN
    SELECT EXISTS(
      SELECT 1 FROM coupon_usage
      WHERE user_id = p_user_id AND coupon_id = v_coupon.id
    ) INTO v_already_used;

    IF v_already_used THEN
      RETURN jsonb_build_object('valid', false, 'error', 'You have already used this coupon');
    END IF;
  END IF;

  -- Calculate discount server-side (NEVER trust client-provided discount)
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := (p_subtotal * v_coupon.discount_value) / 100;
    -- Apply maximum discount cap if set
    IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
      v_discount := v_coupon.maximum_discount;
    END IF;
  ELSE
    -- Fixed discount
    v_discount := v_coupon.discount_value;
    -- Ensure discount doesn't exceed subtotal
    IF v_discount > p_subtotal THEN
      v_discount := p_subtotal;
    END IF;
  END IF;

  -- Round to 2 decimal places
  v_discount := ROUND(v_discount, 2);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount', v_discount,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'description', v_coupon.description
  );

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_and_apply_coupon(UUID, TEXT, DECIMAL) TO authenticated;
