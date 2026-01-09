-- =============================================================================
-- 20L Water Bottle Refill System
-- =============================================================================
-- This schema enables the refundable deposit system for 20L water bottle refills.
-- Users must own bottles (via deposit) before ordering refills.
-- =============================================================================

-- User Water Bottle Deposits
-- Tracks how many 20L bottles each user owns and their deposit balance
CREATE TABLE IF NOT EXISTS user_water_deposits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bottles_owned INTEGER DEFAULT 0 CHECK (bottles_owned >= 0),
    total_deposit_paid DECIMAL(10,2) DEFAULT 0 CHECK (total_deposit_paid >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Water Deposit Transactions
-- Tracks individual deposit purchases and refunds
CREATE TABLE IF NOT EXISTS water_deposit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'refund')),
    bottles_count INTEGER NOT NULL CHECK (bottles_count > 0),
    amount DECIMAL(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Settings for Water Refill Configuration
-- Store water product config in a dedicated settings table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Default water settings
INSERT INTO app_settings (key, value, description) VALUES
    ('water_refill_product_id', 'null', 'Product ID of the 20L water refill bottle'),
    ('water_deposit_per_bottle', '100', 'Refundable deposit amount per bottle in INR')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE user_water_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_deposit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_water_deposits
CREATE POLICY "Users can view own deposits"
    ON user_water_deposits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposits"
    ON user_water_deposits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deposits"
    ON user_water_deposits FOR UPDATE
    USING (auth.uid() = user_id);

-- Admin can view all deposits
CREATE POLICY "Admins can view all deposits"
    ON user_water_deposits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- RLS Policies for water_deposit_transactions
CREATE POLICY "Users can view own transactions"
    ON water_deposit_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
    ON water_deposit_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
    ON water_deposit_transactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- RLS Policies for app_settings
CREATE POLICY "Everyone can read app settings"
    ON app_settings FOR SELECT
    USING (true);

CREATE POLICY "Only admins can modify settings"
    ON app_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_water_deposits_user_id ON user_water_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_water_transactions_user_id ON water_deposit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_water_transactions_order_id ON water_deposit_transactions(order_id);

-- Trigger to update updated_at on user_water_deposits
CREATE OR REPLACE FUNCTION update_water_deposit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_water_deposit_timestamp ON user_water_deposits;
CREATE TRIGGER trigger_update_water_deposit_timestamp
    BEFORE UPDATE ON user_water_deposits
    FOR EACH ROW
    EXECUTE FUNCTION update_water_deposit_timestamp();

-- Function to check if user can order water bottles
CREATE OR REPLACE FUNCTION check_water_order_eligibility(
    p_user_id UUID,
    p_requested_quantity INTEGER
)
RETURNS TABLE (
    eligible BOOLEAN,
    bottles_owned INTEGER,
    deposit_required INTEGER,
    deposit_amount DECIMAL(10,2)
) AS $$
DECLARE
    v_bottles_owned INTEGER;
    v_deposit_per_bottle DECIMAL(10,2);
BEGIN
    -- Get user's owned bottles
    SELECT COALESCE(ud.bottles_owned, 0) INTO v_bottles_owned
    FROM user_water_deposits ud
    WHERE ud.user_id = p_user_id;
    
    -- Default to 0 if no record exists
    IF v_bottles_owned IS NULL THEN
        v_bottles_owned := 0;
    END IF;
    
    -- Get deposit amount from settings
    SELECT (value)::DECIMAL(10,2) INTO v_deposit_per_bottle
    FROM app_settings
    WHERE key = 'water_deposit_per_bottle';
    
    -- If user has enough bottles
    IF v_bottles_owned >= p_requested_quantity THEN
        RETURN QUERY SELECT 
            true AS eligible,
            v_bottles_owned AS bottles_owned,
            0 AS deposit_required,
            0.00 AS deposit_amount;
    ELSE
        -- User needs more bottles (deposit required)
        RETURN QUERY SELECT 
            false AS eligible,
            v_bottles_owned AS bottles_owned,
            (p_requested_quantity - v_bottles_owned) AS deposit_required,
            ((p_requested_quantity - v_bottles_owned) * v_deposit_per_bottle) AS deposit_amount;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
