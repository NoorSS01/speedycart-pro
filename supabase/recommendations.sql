-- =============================================
-- Recommendation System Database Setup
-- Run this in Supabase SQL Editor
-- 
-- Order of execution:
-- 1. Tables
-- 2. Indexes  
-- 3. RLS Policies
-- 4. Triggers (MUST be last)
-- =============================================

-- =============================================
-- PART 1: TABLES
-- =============================================

-- ---------------------------------------------
-- product_co_purchases: Tracks co-occurrence counts
-- ---------------------------------------------
-- NOTE: Pairs are DIRECTIONAL to allow asymmetric recommendations.
-- If A is often bought with B, it doesn't mean B is often bought with A.
-- Example: iPhone case often bought with iPhone, but iPhone not always bought with case.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS product_co_purchases (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  co_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  co_purchase_count INTEGER DEFAULT 1,
  last_purchased_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, co_product_id),
  CONSTRAINT no_self_reference CHECK (product_id != co_product_id)
);

COMMENT ON TABLE product_co_purchases IS 'Directional co-purchase pairs. (A,B) means "people who bought A also bought B". Asymmetric by design.';
COMMENT ON COLUMN product_co_purchases.co_purchase_count IS 'Number of times these products were purchased together in delivered orders.';

-- ---------------------------------------------
-- user_product_views: Tracks product views for personalization
-- ---------------------------------------------
-- Handle existing table with old schema (viewed_at → first_viewed_at, last_viewed_at)
DO $$
BEGIN
  -- Check if table exists with old schema
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_product_views' AND column_name = 'viewed_at'
  ) THEN
    -- Table exists with old schema, migrate it
    -- Add new columns if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_product_views' AND column_name = 'first_viewed_at'
    ) THEN
      ALTER TABLE user_product_views ADD COLUMN first_viewed_at TIMESTAMPTZ DEFAULT NOW();
      -- Copy existing viewed_at to first_viewed_at
      UPDATE user_product_views SET first_viewed_at = viewed_at WHERE first_viewed_at IS NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_product_views' AND column_name = 'last_viewed_at'
    ) THEN
      ALTER TABLE user_product_views ADD COLUMN last_viewed_at TIMESTAMPTZ DEFAULT NOW();
      -- Copy existing viewed_at to last_viewed_at
      UPDATE user_product_views SET last_viewed_at = viewed_at WHERE last_viewed_at IS NULL;
    END IF;
    
    RAISE NOTICE 'Migrated user_product_views from old schema (viewed_at) to new schema (first_viewed_at, last_viewed_at)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_product_views'
  ) THEN
    -- Table doesn't exist, create it with new schema
    CREATE TABLE user_product_views (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      view_count INTEGER DEFAULT 1,
      first_viewed_at TIMESTAMPTZ DEFAULT NOW(),
      last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT user_product_views_unique UNIQUE(user_id, product_id)
    );
    RAISE NOTICE 'Created user_product_views table with new schema';
  ELSE
    RAISE NOTICE 'user_product_views table already exists with correct schema';
  END IF;
END $$;

COMMENT ON TABLE user_product_views IS 'Tracks which products each user has viewed for personalized recommendations.';
COMMENT ON COLUMN user_product_views.first_viewed_at IS 'Preserved for long-term interest signal.';
COMMENT ON COLUMN user_product_views.last_viewed_at IS 'Used for recency scoring in recommendations.';


-- =============================================
-- PART 2: INDEXES
-- =============================================

-- Fast lookup: "What products are frequently bought with product X?"
CREATE INDEX IF NOT EXISTS idx_co_purchases_lookup 
  ON product_co_purchases(product_id, co_purchase_count DESC);

-- Fast lookup: "What has user Y viewed recently?"
CREATE INDEX IF NOT EXISTS idx_user_views_recency 
  ON user_product_views(user_id, last_viewed_at DESC);

-- Fast trending calculation: Recent order items
CREATE INDEX IF NOT EXISTS idx_order_items_trending 
  ON order_items(created_at DESC, product_id);

-- Fast delivered orders lookup for Buy Again
CREATE INDEX IF NOT EXISTS idx_orders_delivered_user
  ON orders(user_id, created_at DESC) WHERE status = 'delivered';


-- =============================================
-- PART 3: RLS POLICIES
-- =============================================

-- product_co_purchases: Public read, system write
ALTER TABLE product_co_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read co-purchases" ON product_co_purchases;
CREATE POLICY "Anyone can read co-purchases" 
  ON product_co_purchases FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert co-purchases" ON product_co_purchases;
CREATE POLICY "System can insert co-purchases" 
  ON product_co_purchases FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update co-purchases" ON product_co_purchases;
CREATE POLICY "System can update co-purchases" 
  ON product_co_purchases FOR UPDATE USING (true);


-- user_product_views: Users manage own, admins read all
ALTER TABLE user_product_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own views" ON user_product_views;
CREATE POLICY "Users can read own views" 
  ON user_product_views FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own views" ON user_product_views;
CREATE POLICY "Users can insert own views" 
  ON user_product_views FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own views" ON user_product_views;
CREATE POLICY "Users can update own views" 
  ON user_product_views FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all views" ON user_product_views;
CREATE POLICY "Admins can read all views" 
  ON user_product_views FOR SELECT 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));


-- =============================================
-- PART 4: TRIGGERS
-- =============================================

-- ---------------------------------------------
-- Trigger Function: Update co-purchases when order is FIRST marked delivered
-- ---------------------------------------------
-- CRITICAL GUARDS:
-- 1. Only fires on TRANSITION to 'delivered' (prevents duplicate counting)
-- 2. Skips orders with >20 items (prevents O(n²) explosion)
-- 3. Uses SECURITY DEFINER to bypass RLS for system operations
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION update_co_purchases_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_item_count INTEGER;
  v_item1 RECORD;
  v_item2 RECORD;
BEGIN
  -- CRITICAL: Only fire on TRANSITION to 'delivered'
  -- This prevents duplicate counting when order is updated multiple times
  IF NOT (OLD.status IS DISTINCT FROM 'delivered' AND NEW.status = 'delivered') THEN
    RETURN NEW;
  END IF;
  
  -- GUARD: Limit O(n²) complexity for large orders
  -- Orders with >20 items would generate 380+ pairs (20*19)
  -- These are rare edge cases (bulk orders) and not representative of typical behavior
  SELECT COUNT(*) INTO v_item_count FROM order_items WHERE order_id = NEW.id;
  
  IF v_item_count > 20 THEN
    RAISE NOTICE 'Skipping co-purchase update for order % with % items (exceeds limit)', NEW.id, v_item_count;
    RETURN NEW;
  END IF;
  
  -- Skip single-item orders (no pairs to generate)
  IF v_item_count < 2 THEN
    RETURN NEW;
  END IF;
  
  -- Generate all ordered pairs (directional: A→B and B→A are separate)
  -- This allows asymmetric recommendations based on primary product
  FOR v_item1 IN (SELECT DISTINCT product_id FROM order_items WHERE order_id = NEW.id) LOOP
    FOR v_item2 IN (SELECT DISTINCT product_id FROM order_items WHERE order_id = NEW.id AND product_id != v_item1.product_id) LOOP
      -- Upsert: Insert new pair or increment existing count
      INSERT INTO product_co_purchases (product_id, co_product_id, co_purchase_count, last_purchased_at)
      VALUES (v_item1.product_id, v_item2.product_id, 1, NOW())
      ON CONFLICT (product_id, co_product_id)
      DO UPDATE SET 
        co_purchase_count = product_co_purchases.co_purchase_count + 1,
        last_purchased_at = NOW();
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION update_co_purchases_on_delivery() IS 
  'Updates co-purchase counts when an order transitions to delivered status. Includes guards for idempotency and large order protection.';

-- Drop existing trigger if it exists (for clean re-runs)
DROP TRIGGER IF EXISTS trigger_co_purchases_on_delivery ON orders;

-- Create trigger on orders table
-- Fires AFTER UPDATE because orders start as 'pending' and transition to 'delivered'
-- WHEN clause provides additional filtering before function is called
CREATE TRIGGER trigger_co_purchases_on_delivery
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_co_purchases_on_delivery();


-- =============================================
-- PART 5: HELPER FUNCTIONS
-- =============================================

-- ---------------------------------------------
-- Function: Get frequently bought together products
-- Used by frontend hook as fallback/optimization
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_frequently_bought_together(
  p_product_id UUID,
  p_limit INTEGER DEFAULT 4,
  p_exclude_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  price DECIMAL(10,2),
  mrp DECIMAL(10,2),
  image_url TEXT,
  unit TEXT,
  stock_quantity INTEGER,
  co_purchase_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.price,
    p.mrp,
    p.image_url,
    p.unit,
    p.stock_quantity,
    cp.co_purchase_count
  FROM product_co_purchases cp
  JOIN products p ON p.id = cp.co_product_id
  WHERE cp.product_id = p_product_id
    AND p.is_active = true
    AND p.stock_quantity > 0
    AND p.id != p_product_id
    AND NOT (p.id = ANY(p_exclude_ids))
  ORDER BY cp.co_purchase_count DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_frequently_bought_together IS 
  'Returns top co-purchased products for a given product, excluding out-of-stock and specified IDs.';


-- ---------------------------------------------
-- Function: Get trending products
-- Time-decay weighted popularity from last 7 days
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_trending_products(
  p_limit INTEGER DEFAULT 10,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  price DECIMAL(10,2),
  mrp DECIMAL(10,2),
  image_url TEXT,
  unit TEXT,
  stock_quantity INTEGER,
  trend_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  v_start_date := NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  WITH order_scores AS (
    SELECT 
      oi.product_id,
      -- Time decay: exp(-days_ago / 7) gives higher weight to recent orders
      SUM(
        EXP(-EXTRACT(EPOCH FROM (NOW() - oi.created_at)) / (p_days * 24 * 60 * 60))
        * (0.7 + 0.3 * oi.quantity / GREATEST(oi.quantity, 1)) -- Hybrid: orders + quantity
      ) as score,
      COUNT(DISTINCT oi.order_id) as order_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.created_at >= v_start_date
      AND o.status = 'delivered'
    GROUP BY oi.product_id
    HAVING COUNT(DISTINCT oi.order_id) >= 1 -- At least 1 order
  )
  SELECT 
    p.id,
    p.name,
    p.price,
    p.mrp,
    p.image_url,
    p.unit,
    p.stock_quantity,
    os.score as trend_score
  FROM order_scores os
  JOIN products p ON p.id = os.product_id
  WHERE p.is_active = true
    AND p.stock_quantity > 0
  ORDER BY os.score DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_trending_products IS 
  'Returns trending products based on time-decay weighted order frequency from delivered orders.';


-- ---------------------------------------------
-- Function: Get buy again products for a user
-- Recency + frequency weighted
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION get_buy_again_products(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  price DECIMAL(10,2),
  mrp DECIMAL(10,2),
  image_url TEXT,
  unit TEXT,
  stock_quantity INTEGER,
  purchase_count INTEGER,
  last_purchased_at TIMESTAMPTZ,
  buy_again_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_purchases AS (
    SELECT 
      oi.product_id,
      COUNT(*) as purchase_count,
      MAX(o.created_at) as last_purchased,
      -- Recency score: exp(-days/30) with 30-day half-life
      EXP(-EXTRACT(EPOCH FROM (NOW() - MAX(o.created_at))) / (30 * 24 * 60 * 60)) as recency_score
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = p_user_id
      AND o.status = 'delivered'
    GROUP BY oi.product_id
  ),
  max_purchases AS (
    SELECT GREATEST(MAX(purchase_count), 1) as max_count FROM user_purchases
  )
  SELECT 
    p.id,
    p.name,
    p.price,
    p.mrp,
    p.image_url,
    p.unit,
    p.stock_quantity,
    up.purchase_count::INTEGER,
    up.last_purchased,
    -- Score: 60% recency + 40% frequency (normalized to user's max)
    (up.recency_score * 0.6 + (up.purchase_count::NUMERIC / mp.max_count) * 0.4) as buy_again_score
  FROM user_purchases up
  CROSS JOIN max_purchases mp
  JOIN products p ON p.id = up.product_id
  WHERE p.is_active = true
    AND p.stock_quantity > 0
  ORDER BY (up.recency_score * 0.6 + (up.purchase_count::NUMERIC / mp.max_count) * 0.4) DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_buy_again_products IS 
  'Returns products a user has previously purchased, sorted by recency (60%) and frequency (40%). Only includes delivered orders.';


-- =============================================
-- SUCCESS MESSAGE
-- =============================================
SELECT 'Recommendation system database setup complete!' as status;
