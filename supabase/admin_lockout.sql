-- Admin Lockout System
-- Run this in Supabase SQL Editor

-- =============================
-- Create admin_settings table
-- =============================
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_locked BOOLEAN DEFAULT FALSE,
    payment_status TEXT DEFAULT 'none', -- 'none', 'pending', 'paid'
    payment_message TEXT,
    locked_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO admin_settings (id, is_locked, payment_status)
VALUES ('00000000-0000-0000-0000-000000000001', FALSE, 'none')
ON CONFLICT (id) DO NOTHING;

-- =============================
-- RLS Policies
-- =============================
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for admin page to check status)
DROP POLICY IF EXISTS "Anyone can view admin settings" ON admin_settings;
CREATE POLICY "Anyone can view admin settings" 
ON admin_settings FOR SELECT USING (true);

-- Only super_admin can update
DROP POLICY IF EXISTS "Super admin can update settings" ON admin_settings;
CREATE POLICY "Super admin can update settings" 
ON admin_settings FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'));

-- Allow admins to update payment_status to 'paid' only
DROP POLICY IF EXISTS "Admin can mark as paid" ON admin_settings;
CREATE POLICY "Admin can mark as paid" 
ON admin_settings FOR UPDATE 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (payment_status = 'paid');

-- =============================
-- Success
-- =============================
SELECT 'Admin lockout system created!' as status;
