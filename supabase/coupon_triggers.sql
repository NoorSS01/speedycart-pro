-- Coupon Trigger System
-- Automatically applies coupons based on user behavior/segments

-- =====================
-- Trigger Types Enum
-- =====================
-- new_user: First-time signup or first order
-- inactivity: User hasn't ordered in X days
-- cart_abandonment: Added items but didn't checkout
-- loyalty: Order frequency/high-value users
-- scheduled: Time-based promotions (e.g., weekend deals)
-- location: Based on delivery area (future)

-- =====================
-- Coupon Triggers Table
-- =====================
CREATE TABLE IF NOT EXISTS coupon_triggers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'new_user', 
        'inactivity', 
        'cart_abandonment', 
        'loyalty', 
        'scheduled'
    )),
    
    -- Trigger conditions (JSON for flexibility)
    conditions JSONB DEFAULT '{}',
    -- Examples:
    -- inactivity: {"days_inactive": 7}
    -- loyalty: {"min_orders": 5, "min_total_spend": 1000}
    -- scheduled: {"start_time": "09:00", "end_time": "12:00", "days": ["saturday", "sunday"]}
    
    -- Coupon details
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2), -- Cap for percentage discounts
    
    -- Validity
    coupon_code_prefix TEXT DEFAULT 'AUTO', -- Generated codes will be PREFIX-XXXXX
    coupon_valid_days INTEGER DEFAULT 7, -- How long the generated coupon is valid
    
    -- Limits
    max_uses_per_user INTEGER DEFAULT 1,
    max_total_uses INTEGER DEFAULT NULL, -- NULL = unlimited
    current_uses INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority triggers are checked first
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ
);

-- =====================
-- User Triggered Coupons Table
-- =====================
-- Stores coupons that were automatically generated for users
CREATE TABLE IF NOT EXISTS user_triggered_coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_id UUID NOT NULL REFERENCES coupon_triggers(id) ON DELETE CASCADE,
    
    -- Generated coupon details
    coupon_code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2),
    
    -- Status
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    order_id UUID REFERENCES orders(id),
    
    -- Validity
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_coupon_triggers_active ON coupon_triggers(is_active, trigger_type);
CREATE INDEX IF NOT EXISTS idx_user_triggered_coupons_user ON user_triggered_coupons(user_id, is_used);
CREATE INDEX IF NOT EXISTS idx_user_triggered_coupons_code ON user_triggered_coupons(coupon_code);

-- =====================
-- RLS Policies
-- =====================
ALTER TABLE coupon_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_triggered_coupons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage triggers" ON coupon_triggers;
DROP POLICY IF EXISTS "Anyone can view active triggers" ON coupon_triggers;
DROP POLICY IF EXISTS "Users can view own triggered coupons" ON user_triggered_coupons;
DROP POLICY IF EXISTS "System can create triggered coupons" ON user_triggered_coupons;
DROP POLICY IF EXISTS "Users can mark own coupons used" ON user_triggered_coupons;

-- Triggers: Admins full access
CREATE POLICY "Admins can manage triggers" ON coupon_triggers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Triggers: Anyone can see active triggers (for frontend logic)
CREATE POLICY "Anyone can view active triggers" ON coupon_triggers
    FOR SELECT USING (is_active = true);

-- User Coupons: Users can see their own
CREATE POLICY "Users can view own triggered coupons" ON user_triggered_coupons
    FOR SELECT USING (user_id = auth.uid());

-- User Coupons: System can create (via service role)
CREATE POLICY "System can create triggered coupons" ON user_triggered_coupons
    FOR INSERT WITH CHECK (true);

-- User Coupons: Users can mark their own as used
CREATE POLICY "Users can mark own coupons used" ON user_triggered_coupons
    FOR UPDATE USING (user_id = auth.uid());
