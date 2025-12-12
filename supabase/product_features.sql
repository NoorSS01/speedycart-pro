-- Product Features Database Setup
-- Run this in Supabase SQL Editor to enable RLS and triggers

-- =============================
-- RLS Policies for product_variants
-- =============================
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view variants" ON product_variants;
CREATE POLICY "Anyone can view variants" 
ON product_variants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert variants" ON product_variants;
CREATE POLICY "Admins can insert variants" 
ON product_variants FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can update variants" ON product_variants;
CREATE POLICY "Admins can update variants" 
ON product_variants FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete variants" ON product_variants;
CREATE POLICY "Admins can delete variants" 
ON product_variants FOR DELETE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));


-- =============================
-- RLS Policies for product_co_purchases
-- =============================
ALTER TABLE product_co_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view co-purchases" ON product_co_purchases;
CREATE POLICY "Anyone can view co-purchases" 
ON product_co_purchases FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert co-purchases" ON product_co_purchases;
CREATE POLICY "System can insert co-purchases" 
ON product_co_purchases FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update co-purchases" ON product_co_purchases;
CREATE POLICY "System can update co-purchases" 
ON product_co_purchases FOR UPDATE USING (true);


-- =============================
-- Trigger to track co-purchases when order is placed
-- =============================
CREATE OR REPLACE FUNCTION update_co_purchases()
RETURNS TRIGGER AS $$
DECLARE
  item1 RECORD;
  item2 RECORD;
BEGIN
  -- Get all products in this order
  FOR item1 IN SELECT product_id FROM order_items WHERE order_id = NEW.order_id LOOP
    FOR item2 IN SELECT product_id FROM order_items WHERE order_id = NEW.order_id AND product_id != item1.product_id LOOP
      -- Insert or update co-purchase count
      INSERT INTO product_co_purchases (product_id, co_product_id, co_purchase_count)
      VALUES (item1.product_id, item2.product_id, 1)
      ON CONFLICT (product_id, co_product_id)
      DO UPDATE SET 
        co_purchase_count = product_co_purchases.co_purchase_count + 1,
        last_purchased_at = NOW();
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_co_purchases ON order_items;
CREATE TRIGGER trigger_update_co_purchases
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_co_purchases();


-- =============================
-- Success message
-- =============================
SELECT 'Product features database setup complete!' as status;
