-- Flash Deals System
-- Time-limited deals with live countdown timer
-- High-visibility promotional offers

CREATE TABLE IF NOT EXISTS flash_deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Display Info
    name TEXT NOT NULL,     -- Internal name
    title TEXT NOT NULL,    -- Display title like "FLASH DEALS"
    badge_text TEXT,        -- Like "Up To 80% Off"
    badge_color TEXT DEFAULT '#ec4899',
    
    -- Timer/Scheduling (REQUIRED for flash deals)
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    -- Styling
    background_color TEXT DEFAULT '#fef3c7',
    text_color TEXT DEFAULT '#000000',
    timer_bg_color TEXT DEFAULT '#1e293b',
    timer_text_color TEXT DEFAULT '#ffffff',
    
    -- Product Filter (same as offer_sections)
    filter_type TEXT NOT NULL DEFAULT 'discount' CHECK (filter_type IN ('discount', 'category', 'tags', 'manual')),
    filter_config JSONB DEFAULT '{}',
    
    -- Display Settings
    max_products INTEGER DEFAULT 8,
    show_see_all BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_flash_deals_active ON flash_deals(is_active, start_time, end_time);

-- Enable RLS
ALTER TABLE flash_deals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active flash deals" ON flash_deals;
DROP POLICY IF EXISTS "Admins can manage flash deals" ON flash_deals;

-- Anyone can view active flash deals (within time window)
CREATE POLICY "Anyone can view active flash deals" ON flash_deals
    FOR SELECT USING (
        is_active = true 
        AND start_time <= NOW()
        AND end_time >= NOW()
    );

-- Admins can manage flash deals
CREATE POLICY "Admins can manage flash deals" ON flash_deals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
