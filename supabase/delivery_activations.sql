-- Delivery Partner Daily Activation System
-- Delivery partners request to go active, admin approves, valid for 1 day only

CREATE TABLE IF NOT EXISTS delivery_activations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_partner_id UUID NOT NULL,
    activation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_id UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_until TIMESTAMPTZ,
    duration_hours INTEGER DEFAULT 8,
    
    -- Unique constraint: one request per partner per day
    UNIQUE(delivery_partner_id, activation_date)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_delivery_activations_partner_date ON delivery_activations(delivery_partner_id, activation_date);
CREATE INDEX IF NOT EXISTS idx_delivery_activations_pending ON delivery_activations(status, activation_date);

-- Enable RLS
ALTER TABLE delivery_activations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Delivery partners can view own activations" ON delivery_activations;
DROP POLICY IF EXISTS "Delivery partners can request activation" ON delivery_activations;
DROP POLICY IF EXISTS "Admins can manage activations" ON delivery_activations;

-- Delivery partners can view their own activations
CREATE POLICY "Delivery partners can view own activations" ON delivery_activations
    FOR SELECT USING (
        delivery_partner_id = auth.uid()
    );

-- Delivery partners can request activation (insert only)
CREATE POLICY "Delivery partners can request activation" ON delivery_activations
    FOR INSERT WITH CHECK (
        delivery_partner_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'delivery'
        )
    );

-- Admins can view and manage all activations
CREATE POLICY "Admins can manage activations" ON delivery_activations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
