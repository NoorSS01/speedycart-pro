-- Offer Sections System
-- Dynamic offer zones like "50% OFF Zone", "Winter Store", etc.
-- Links to products by discount range, category, or manual selection

CREATE TABLE IF NOT EXISTS offer_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Display Info
    name TEXT NOT NULL,  -- Internal name for admin
    title TEXT NOT NULL, -- Display title like "50% OFF Zone"
    subtitle TEXT,       -- Like "Half the price, double the joy!"
    
    -- Banner Styling
    background_type TEXT DEFAULT 'gradient' CHECK (background_type IN ('gradient', 'image', 'color')),
    background_value TEXT DEFAULT 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    text_color TEXT DEFAULT '#ffffff',
    image_url TEXT,      -- Optional decorative image
    
    -- Product Filter Criteria (JSON for flexibility)
    filter_type TEXT NOT NULL DEFAULT 'discount' CHECK (filter_type IN ('discount', 'category', 'tags', 'manual')),
    filter_config JSONB DEFAULT '{}',
    -- Examples:
    -- discount: {"min_discount": 40, "max_discount": 60}
    -- category: {"category_ids": ["uuid1", "uuid2"]}
    -- tags: {"tags": ["winter", "essential"]}
    -- manual: {"product_ids": ["uuid1", "uuid2", ...]}
    
    -- Display Settings
    max_products INTEGER DEFAULT 10,
    show_see_all BOOLEAN DEFAULT true,
    see_all_link TEXT, -- Optional custom link, else auto-generated
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    
    -- Scheduling
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_offer_sections_active ON offer_sections(is_active, display_order);

-- Enable RLS
ALTER TABLE offer_sections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active offer sections" ON offer_sections;
DROP POLICY IF EXISTS "Admins can manage offer sections" ON offer_sections;

-- Anyone can view active offer sections
CREATE POLICY "Anyone can view active offer sections" ON offer_sections
    FOR SELECT USING (
        is_active = true 
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
    );

-- Admins can manage offer sections
CREATE POLICY "Admins can manage offer sections" ON offer_sections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
