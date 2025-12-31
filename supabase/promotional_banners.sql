-- Promotional Banners Table
-- Admin-controlled banners for Shop page promotions

CREATE TABLE IF NOT EXISTS promotional_banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    link_url TEXT,
    background_color TEXT DEFAULT '#22c55e', -- Default green
    text_color TEXT DEFAULT '#ffffff',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promotional_banners_active ON promotional_banners(is_active, display_order);

-- Enable RLS
ALTER TABLE promotional_banners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view active banners" ON promotional_banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON promotional_banners;

-- Policy: Anyone can view active banners
CREATE POLICY "Anyone can view active banners" ON promotional_banners
    FOR SELECT USING (
        is_active = true 
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
    );

-- Policy: Admins can manage banners (all operations)
CREATE POLICY "Admins can manage banners" ON promotional_banners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
-- Note: Banners should be created manually via the Admin panel at /admin/banners
-- This avoids duplicate entries when the SQL is run multiple times
