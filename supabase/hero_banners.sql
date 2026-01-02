-- Hero Banners System
-- Large customizable banners for Shop page homepage
-- Supports full-width images, gradients, buttons, and rich styling

CREATE TABLE IF NOT EXISTS hero_banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Content
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    
    -- Visual Design
    background_type TEXT NOT NULL DEFAULT 'gradient' CHECK (background_type IN ('gradient', 'image', 'color')),
    background_value TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    -- gradient: CSS gradient string
    -- image: URL to image
    -- color: hex color
    
    image_url TEXT, -- Optional overlay/product image
    image_position TEXT DEFAULT 'right' CHECK (image_position IN ('left', 'right', 'center', 'background')),
    
    -- Text Styling
    text_color TEXT DEFAULT '#ffffff',
    text_align TEXT DEFAULT 'left' CHECK (text_align IN ('left', 'center', 'right')),
    
    -- Button
    button_text TEXT,
    button_link TEXT,
    button_bg_color TEXT DEFAULT '#ffffff',
    button_text_color TEXT DEFAULT '#000000',
    
    -- Click Navigation (what happens when banner is clicked)
    click_type TEXT DEFAULT 'none' CHECK (click_type IN ('none', 'category', 'product', 'url')),
    click_target TEXT, -- category_id, product_id, or URL depending on click_type
    
    -- Layout
    height TEXT DEFAULT '200px', -- CSS height value
    border_radius TEXT DEFAULT '16px',
    
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
CREATE INDEX IF NOT EXISTS idx_hero_banners_active ON hero_banners(is_active, display_order);

-- Enable RLS
ALTER TABLE hero_banners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active hero banners" ON hero_banners;
DROP POLICY IF EXISTS "Admins can manage hero banners" ON hero_banners;

-- Anyone can view active banners
CREATE POLICY "Anyone can view active hero banners" ON hero_banners
    FOR SELECT USING (
        is_active = true 
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
    );

-- Admins can manage banners
CREATE POLICY "Admins can manage hero banners" ON hero_banners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
