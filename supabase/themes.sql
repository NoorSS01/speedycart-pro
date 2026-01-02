-- Platform Theming System
-- Allows admins to create and activate professional seasonal/festival themes

CREATE TABLE IF NOT EXISTS themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'custom' CHECK (type IN ('seasonal', 'festival', 'custom')),
    is_active BOOLEAN DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    
    -- Color scheme
    primary_color TEXT DEFAULT '#8B5CF6',
    secondary_color TEXT DEFAULT '#D946EF',
    accent_color TEXT DEFAULT '#F59E0B',
    background_gradient TEXT,
    
    -- Animations
    animation_type TEXT CHECK (animation_type IN ('none', 'snowfall', 'leaves', 'rain', 'confetti', 'sparkles', 'petals')),
    animation_intensity TEXT DEFAULT 'medium' CHECK (animation_intensity IN ('low', 'medium', 'high')),
    
    -- Visual elements
    header_banner_url TEXT,
    logo_overlay_url TEXT,
    corner_decoration_url TEXT,
    
    -- Text customizations
    promo_badge_text TEXT,
    promo_badge_color TEXT,
    
    -- Effects
    glassmorphism_enabled BOOLEAN DEFAULT false,
    custom_font TEXT,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one theme can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_themes_single_active ON themes (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active themes" ON themes;
DROP POLICY IF EXISTS "Admins can manage themes" ON themes;

-- Anyone can view active themes
CREATE POLICY "Anyone can view active themes" ON themes
    FOR SELECT USING (true);

-- Admins can manage themes
CREATE POLICY "Admins can manage themes" ON themes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Insert prebuilt seasonal themes
INSERT INTO themes (name, type, primary_color, secondary_color, accent_color, background_gradient, animation_type, animation_intensity, promo_badge_text, promo_badge_color)
VALUES 
    ('Winter Wonderland', 'seasonal', '#3B82F6', '#60A5FA', '#93C5FD', 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e3a5f 100%)', 'snowfall', 'medium', '❄️ Winter Sale', '#3B82F6'),
    ('Summer Vibes', 'seasonal', '#F59E0B', '#FBBF24', '#FEF3C7', 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)', 'sparkles', 'low', '☀️ Summer Deals', '#F59E0B'),
    ('Monsoon Magic', 'seasonal', '#0EA5E9', '#38BDF8', '#7DD3FC', 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0284c7 100%)', 'rain', 'medium', '🌧️ Monsoon Offers', '#0EA5E9'),
    ('Spring Bloom', 'seasonal', '#EC4899', '#F472B6', '#FBCFE8', 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)', 'petals', 'low', '🌸 Spring Special', '#EC4899')
ON CONFLICT DO NOTHING;
