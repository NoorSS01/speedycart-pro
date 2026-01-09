-- ============================================================================
-- ENTERPRISE THEME SYSTEM - Enhanced Database Schema
-- ============================================================================
-- This schema replaces the limited original themes table with a comprehensive
-- system supporting full theme tokens, microinteractions, atmosphere effects,
-- content emphasis, scheduling, versioning, and audit logging.
-- ============================================================================

-- Drop old policies first (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view active themes" ON themes;
DROP POLICY IF EXISTS "Admins can manage themes" ON themes;

-- ============================================================================
-- THEMES TABLE - Complete Theme Storage
-- ============================================================================

-- Add new columns to existing themes table (preserving existing data)
ALTER TABLE themes 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_version INTEGER,
ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT,

-- Complete color tokens (JSONB for flexibility)
ADD COLUMN IF NOT EXISTS color_tokens JSONB DEFAULT '{}'::jsonb,

-- Microinteraction configuration
ADD COLUMN IF NOT EXISTS microinteraction_config JSONB DEFAULT '{
  "durations": {"instant": 50, "fast": 150, "normal": 250, "slow": 400, "atmospheric": 1500},
  "timingFunction": "ease-out",
  "buttonHoverScale": 1.02,
  "buttonHoverLift": -2,
  "buttonPressScale": 0.98,
  "buttonPressDuration": 100,
  "cardHoverScale": 1.01,
  "cardHoverLift": -4,
  "cardHoverShadowBlur": 16,
  "cardHoverShadowSpread": 4,
  "focusRingWidth": 2,
  "focusRingOffset": 2,
  "toggleDuration": 200,
  "toggleBounce": false,
  "loadingPulseScale": 1.05,
  "loadingPulseDuration": 1500,
  "shimmerDuration": 2000,
  "shimmerAngle": 90
}'::jsonb,

-- Atmosphere configuration (particles, overlays)
ADD COLUMN IF NOT EXISTS atmosphere_config JSONB DEFAULT '{
  "particles": {
    "type": "none",
    "density": 0,
    "sizeMin": 4,
    "sizeMax": 8,
    "speedMin": 20,
    "speedMax": 60,
    "opacityMin": 0.3,
    "opacityMax": 0.8,
    "drift": 10,
    "rotation": false,
    "rotationSpeed": 0,
    "color": "0 0% 100%",
    "colorVariance": 0
  },
  "overlay": {"enabled": false},
  "performanceTier": "medium",
  "respectReducedMotion": true,
  "pauseWhenHidden": true,
  "fpsTarget": 60
}'::jsonb,

-- Content emphasis (hero, promo, categories)
ADD COLUMN IF NOT EXISTS content_emphasis JSONB DEFAULT '{
  "hero": {"enabled": false},
  "promo": {"bannerEnabled": false, "badgeEnabled": false, "categoryEmphasis": []},
  "emptyState": {"illustrationVariant": "default"}
}'::jsonb,

-- Typography overrides
ADD COLUMN IF NOT EXISTS typography_config JSONB DEFAULT '{
  "headingWeight": 700,
  "headingLetterSpacing": "-0.02em",
  "bodyLineHeight": 1.6
}'::jsonb,

-- Accessibility settings
ADD COLUMN IF NOT EXISTS accessibility_config JSONB DEFAULT '{
  "minContrastNormal": 4.5,
  "minContrastLarge": 3.0,
  "reducedMotionDurations": {"instant": 0, "fast": 0, "normal": 0, "slow": 0, "atmospheric": 0},
  "disableParticles": true,
  "disableOverlayAnimations": true,
  "enhancedFocusIndicators": true
}'::jsonb,

-- Performance tier hint (used when auto-detection fails)
ADD COLUMN IF NOT EXISTS performance_tier TEXT DEFAULT 'medium' 
  CHECK (performance_tier IN ('high', 'medium', 'low', 'static'));

-- Rename existing date columns for clarity
ALTER TABLE themes RENAME COLUMN starts_at TO schedule_starts_at;
ALTER TABLE themes RENAME COLUMN ends_at TO schedule_ends_at;

-- Add timezone awareness
ALTER TABLE themes ADD COLUMN IF NOT EXISTS schedule_timezone TEXT DEFAULT 'Asia/Kolkata';

-- ============================================================================
-- THEME AUDIT LOG - Track All Changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS theme_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'activate', 'deactivate', 'delete', 'preview', 'rollback')),
    
    -- Who made the change
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- What changed
    changes_summary TEXT,
    before_state JSONB,
    after_state JSONB,
    
    -- Rollback info
    is_rollback_point BOOLEAN DEFAULT false,
    rollback_available BOOLEAN DEFAULT true
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_theme_audit_theme_id ON theme_audit_log(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_audit_performed_at ON theme_audit_log(performed_at DESC);

-- ============================================================================
-- THEME PRESETS - Reusable Microinteraction & Atmosphere Configs
-- ============================================================================

CREATE TABLE IF NOT EXISTS theme_presets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('microinteraction', 'atmosphere', 'color_palette')),
    description TEXT,
    config JSONB NOT NULL,
    is_system_preset BOOLEAN DEFAULT false, -- System presets cannot be deleted
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_presets ENABLE ROW LEVEL SECURITY;

-- Themes: Anyone can view active/non-preview themes
CREATE POLICY "Public can view active themes" ON themes
    FOR SELECT USING (is_active = true AND is_preview = false);

-- Themes: Admins can view all
CREATE POLICY "Admins can view all themes" ON themes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Themes: Admins can manage
CREATE POLICY "Admins can manage themes" ON themes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Audit log: Admins only
CREATE POLICY "Admins can view audit log" ON theme_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can insert audit log" ON theme_audit_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Presets: Anyone can view, admins can manage
CREATE POLICY "Anyone can view presets" ON theme_presets
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage presets" ON theme_presets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- TRIGGER: Auto-log Theme Changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_theme_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO theme_audit_log (theme_id, action, performed_by, changes_summary, after_state)
        VALUES (NEW.id, 'create', auth.uid(), 'Theme created: ' || NEW.name, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine action type
        DECLARE
            action_type TEXT := 'update';
        BEGIN
            IF OLD.is_active = false AND NEW.is_active = true THEN
                action_type := 'activate';
            ELSIF OLD.is_active = true AND NEW.is_active = false THEN
                action_type := 'deactivate';
            END IF;
            
            INSERT INTO theme_audit_log (theme_id, action, performed_by, changes_summary, before_state, after_state, is_rollback_point)
            VALUES (
                NEW.id, 
                action_type, 
                auth.uid(), 
                'Theme updated: ' || NEW.name,
                to_jsonb(OLD),
                to_jsonb(NEW),
                action_type = 'activate' -- Mark activations as rollback points
            );
        END;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO theme_audit_log (theme_id, action, performed_by, changes_summary, before_state, rollback_available)
        VALUES (OLD.id, 'delete', auth.uid(), 'Theme deleted: ' || OLD.name, to_jsonb(OLD), false);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS theme_audit_trigger ON themes;
CREATE TRIGGER theme_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON themes
    FOR EACH ROW EXECUTE FUNCTION log_theme_change();

-- ============================================================================
-- UPDATE PREBUILT SEASONAL THEMES WITH FULL CONFIGURATION
-- ============================================================================

-- Winter Wonderland: Calm, cozy, premium
UPDATE themes SET
    description = 'A calm, cozy winter theme with soft snowfall and warm accents',
    color_tokens = '{
        "background": "220 20% 98%",
        "foreground": "220 20% 10%",
        "card": "220 15% 100%",
        "cardForeground": "220 20% 10%",
        "popover": "220 15% 100%",
        "popoverForeground": "220 20% 10%",
        "primary": "210 100% 45%",
        "primaryForeground": "0 0% 100%",
        "secondary": "210 30% 92%",
        "secondaryForeground": "210 100% 35%",
        "muted": "210 20% 96%",
        "mutedForeground": "210 15% 45%",
        "accent": "30 90% 55%",
        "accentForeground": "30 10% 15%",
        "destructive": "0 84% 60%",
        "destructiveForeground": "0 0% 100%",
        "border": "210 20% 90%",
        "input": "210 20% 90%",
        "ring": "210 100% 45%",
        "success": "142 76% 36%",
        "warning": "38 92% 50%",
        "info": "199 89% 48%"
    }'::jsonb,
    microinteraction_config = '{
        "durations": {"instant": 50, "fast": 180, "normal": 300, "slow": 500, "atmospheric": 2000},
        "timingFunction": "ease-in-out",
        "buttonHoverScale": 1.015,
        "buttonHoverLift": -1,
        "buttonPressScale": 0.99,
        "buttonPressDuration": 120,
        "cardHoverScale": 1.005,
        "cardHoverLift": -2,
        "cardHoverShadowBlur": 12,
        "cardHoverShadowSpread": 2,
        "focusRingWidth": 2,
        "focusRingOffset": 2,
        "toggleDuration": 250,
        "toggleBounce": false,
        "loadingPulseScale": 1.03,
        "loadingPulseDuration": 2000,
        "shimmerDuration": 2500,
        "shimmerAngle": 90
    }'::jsonb,
    atmosphere_config = '{
        "particles": {
            "type": "snowfall",
            "density": 25,
            "sizeMin": 3,
            "sizeMax": 8,
            "speedMin": 15,
            "speedMax": 40,
            "opacityMin": 0.4,
            "opacityMax": 0.9,
            "drift": 15,
            "rotation": false,
            "rotationSpeed": 0,
            "color": "210 30% 95%",
            "colorVariance": 10
        },
        "overlay": {
            "enabled": true,
            "glowSpots": {
                "positions": [{"x": 15, "y": 20}, {"x": 85, "y": 30}],
                "color": "30 80% 70%",
                "radius": 200,
                "blur": 100,
                "opacity": 0.15,
                "animate": true
            }
        },
        "performanceTier": "medium",
        "respectReducedMotion": true,
        "pauseWhenHidden": true,
        "fpsTarget": 30
    }'::jsonb,
    content_emphasis = '{
        "hero": {"enabled": true, "overlayGradient": "linear-gradient(135deg, rgba(30,58,95,0.9) 0%, rgba(15,23,42,0.95) 100%)", "headlineColor": "0 0% 100%", "subheadlineColor": "210 30% 80%", "ctaVariant": "accent"},
        "promo": {"bannerEnabled": true, "bannerText": "❄️ Winter Sale - Up to 40% Off!", "bannerBackgroundColor": "210 100% 45%", "bannerTextColor": "0 0% 100%", "bannerDismissible": true, "badgeEnabled": true, "badgeText": "Winter Deal", "badgeColor": "210 100% 45%", "categoryEmphasis": []},
        "emptyState": {"illustrationVariant": "seasonal", "messageTemplate": "Brrr... nothing here yet!"}
    }'::jsonb
WHERE name = 'Winter Wonderland';

-- Summer Vibes: Energetic, bright, optimistic
UPDATE themes SET
    description = 'An energetic, bright summer theme with warm golden tones',
    color_tokens = '{
        "background": "45 100% 98%",
        "foreground": "30 20% 15%",
        "card": "45 80% 100%",
        "cardForeground": "30 20% 15%",
        "popover": "45 80% 100%",
        "popoverForeground": "30 20% 15%",
        "primary": "38 95% 50%",
        "primaryForeground": "30 10% 10%",
        "secondary": "38 50% 92%",
        "secondaryForeground": "38 95% 40%",
        "muted": "38 30% 96%",
        "mutedForeground": "30 15% 45%",
        "accent": "15 90% 55%",
        "accentForeground": "0 0% 100%",
        "destructive": "0 84% 60%",
        "destructiveForeground": "0 0% 100%",
        "border": "38 30% 88%",
        "input": "38 30% 88%",
        "ring": "38 95% 50%",
        "success": "142 76% 36%",
        "warning": "25 100% 50%",
        "info": "199 89% 48%"
    }'::jsonb,
    microinteraction_config = '{
        "durations": {"instant": 40, "fast": 120, "normal": 200, "slow": 350, "atmospheric": 1200},
        "timingFunction": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "buttonHoverScale": 1.03,
        "buttonHoverLift": -3,
        "buttonPressScale": 0.97,
        "buttonPressDuration": 80,
        "cardHoverScale": 1.02,
        "cardHoverLift": -5,
        "cardHoverShadowBlur": 20,
        "cardHoverShadowSpread": 5,
        "focusRingWidth": 3,
        "focusRingOffset": 2,
        "toggleDuration": 180,
        "toggleBounce": true,
        "loadingPulseScale": 1.08,
        "loadingPulseDuration": 1200,
        "shimmerDuration": 1500,
        "shimmerAngle": 75
    }'::jsonb,
    atmosphere_config = '{
        "particles": {
            "type": "sparkles",
            "density": 15,
            "sizeMin": 4,
            "sizeMax": 10,
            "speedMin": 5,
            "speedMax": 20,
            "opacityMin": 0.3,
            "opacityMax": 0.7,
            "drift": 5,
            "rotation": false,
            "rotationSpeed": 0,
            "color": "45 100% 70%",
            "colorVariance": 15
        },
        "overlay": {
            "enabled": true,
            "gradientWash": {
                "colors": ["45 100% 95%", "38 80% 90%"],
                "angle": 135,
                "opacity": 0.3
            }
        },
        "performanceTier": "medium",
        "respectReducedMotion": true,
        "pauseWhenHidden": true,
        "fpsTarget": 30
    }'::jsonb,
    content_emphasis = '{
        "hero": {"enabled": true, "overlayGradient": "linear-gradient(135deg, rgba(254,243,199,0.95) 0%, rgba(253,230,138,0.9) 100%)", "headlineColor": "30 30% 15%", "subheadlineColor": "30 20% 35%", "ctaVariant": "primary"},
        "promo": {"bannerEnabled": true, "bannerText": "☀️ Summer Deals - Beat the Heat!", "bannerBackgroundColor": "38 95% 50%", "bannerTextColor": "30 10% 10%", "bannerDismissible": true, "badgeEnabled": true, "badgeText": "Hot Deal", "badgeColor": "15 90% 55%", "categoryEmphasis": []},
        "emptyState": {"illustrationVariant": "seasonal", "messageTemplate": "Nothing here... time for a beach break? 🏖️"}
    }'::jsonb
WHERE name = 'Summer Vibes';

-- Monsoon Magic: Fresh, calming, trustworthy
UPDATE themes SET
    description = 'A fresh, calming monsoon theme with rain effects and cool tones',
    color_tokens = '{
        "background": "200 30% 98%",
        "foreground": "200 30% 12%",
        "card": "200 20% 100%",
        "cardForeground": "200 30% 12%",
        "popover": "200 20% 100%",
        "popoverForeground": "200 30% 12%",
        "primary": "199 89% 48%",
        "primaryForeground": "0 0% 100%",
        "secondary": "199 40% 92%",
        "secondaryForeground": "199 89% 38%",
        "muted": "199 25% 96%",
        "mutedForeground": "200 20% 45%",
        "accent": "180 70% 45%",
        "accentForeground": "0 0% 100%",
        "destructive": "0 84% 60%",
        "destructiveForeground": "0 0% 100%",
        "border": "199 25% 88%",
        "input": "199 25% 88%",
        "ring": "199 89% 48%",
        "success": "142 76% 36%",
        "warning": "38 92% 50%",
        "info": "199 89% 48%"
    }'::jsonb,
    microinteraction_config = '{
        "durations": {"instant": 50, "fast": 160, "normal": 280, "slow": 450, "atmospheric": 1800},
        "timingFunction": "cubic-bezier(0.4, 0, 0.2, 1)",
        "buttonHoverScale": 1.02,
        "buttonHoverLift": -2,
        "buttonPressScale": 0.98,
        "buttonPressDuration": 100,
        "cardHoverScale": 1.01,
        "cardHoverLift": -3,
        "cardHoverShadowBlur": 14,
        "cardHoverShadowSpread": 3,
        "focusRingWidth": 2,
        "focusRingOffset": 2,
        "toggleDuration": 220,
        "toggleBounce": false,
        "loadingPulseScale": 1.04,
        "loadingPulseDuration": 1800,
        "shimmerDuration": 2200,
        "shimmerAngle": 80
    }'::jsonb,
    atmosphere_config = '{
        "particles": {
            "type": "rain",
            "density": 40,
            "sizeMin": 1,
            "sizeMax": 2,
            "speedMin": 200,
            "speedMax": 400,
            "opacityMin": 0.2,
            "opacityMax": 0.6,
            "drift": 2,
            "rotation": false,
            "rotationSpeed": 0,
            "color": "199 60% 70%",
            "colorVariance": 5
        },
        "overlay": {
            "enabled": true,
            "vignette": {
                "color": "200 40% 20%",
                "intensity": 0.15
            }
        },
        "performanceTier": "medium",
        "respectReducedMotion": true,
        "pauseWhenHidden": true,
        "fpsTarget": 60
    }'::jsonb,
    content_emphasis = '{
        "hero": {"enabled": true, "overlayGradient": "linear-gradient(135deg, rgba(12,74,110,0.92) 0%, rgba(3,105,161,0.88) 100%)", "headlineColor": "0 0% 100%", "subheadlineColor": "199 40% 85%", "ctaVariant": "accent"},
        "promo": {"bannerEnabled": true, "bannerText": "🌧️ Monsoon Offers - Fresh Deals!", "bannerBackgroundColor": "199 89% 48%", "bannerTextColor": "0 0% 100%", "bannerDismissible": true, "badgeEnabled": true, "badgeText": "Monsoon Special", "badgeColor": "180 70% 45%", "categoryEmphasis": []},
        "emptyState": {"illustrationVariant": "seasonal", "messageTemplate": "Looks like the rain washed everything away... 🌧️"}
    }'::jsonb
WHERE name = 'Monsoon Magic';

-- Spring Bloom: Joyful, renewing, delicate
UPDATE themes SET
    description = 'A joyful, renewing spring theme with floating petals and soft pastels',
    color_tokens = '{
        "background": "330 50% 98%",
        "foreground": "330 20% 15%",
        "card": "330 40% 100%",
        "cardForeground": "330 20% 15%",
        "popover": "330 40% 100%",
        "popoverForeground": "330 20% 15%",
        "primary": "330 80% 55%",
        "primaryForeground": "0 0% 100%",
        "secondary": "330 40% 93%",
        "secondaryForeground": "330 80% 45%",
        "muted": "330 25% 96%",
        "mutedForeground": "330 15% 45%",
        "accent": "150 60% 50%",
        "accentForeground": "0 0% 100%",
        "destructive": "0 84% 60%",
        "destructiveForeground": "0 0% 100%",
        "border": "330 25% 90%",
        "input": "330 25% 90%",
        "ring": "330 80% 55%",
        "success": "142 76% 36%",
        "warning": "38 92% 50%",
        "info": "199 89% 48%"
    }'::jsonb,
    microinteraction_config = '{
        "durations": {"instant": 45, "fast": 140, "normal": 240, "slow": 400, "atmospheric": 1500},
        "timingFunction": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "buttonHoverScale": 1.025,
        "buttonHoverLift": -2,
        "buttonPressScale": 0.98,
        "buttonPressDuration": 90,
        "cardHoverScale": 1.015,
        "cardHoverLift": -4,
        "cardHoverShadowBlur": 16,
        "cardHoverShadowSpread": 4,
        "focusRingWidth": 2,
        "focusRingOffset": 2,
        "toggleDuration": 200,
        "toggleBounce": true,
        "loadingPulseScale": 1.06,
        "loadingPulseDuration": 1400,
        "shimmerDuration": 1800,
        "shimmerAngle": 85
    }'::jsonb,
    atmosphere_config = '{
        "particles": {
            "type": "petals",
            "density": 20,
            "sizeMin": 8,
            "sizeMax": 16,
            "speedMin": 20,
            "speedMax": 50,
            "opacityMin": 0.5,
            "opacityMax": 0.9,
            "drift": 25,
            "rotation": true,
            "rotationSpeed": 45,
            "color": "330 70% 80%",
            "colorVariance": 20
        },
        "overlay": {
            "enabled": true,
            "gradientWash": {
                "colors": ["330 60% 97%", "150 40% 95%"],
                "angle": 120,
                "opacity": 0.25
            }
        },
        "performanceTier": "medium",
        "respectReducedMotion": true,
        "pauseWhenHidden": true,
        "fpsTarget": 30
    }'::jsonb,
    content_emphasis = '{
        "hero": {"enabled": true, "overlayGradient": "linear-gradient(135deg, rgba(252,231,243,0.95) 0%, rgba(251,207,232,0.9) 100%)", "headlineColor": "330 40% 20%", "subheadlineColor": "330 30% 35%", "ctaVariant": "primary"},
        "promo": {"bannerEnabled": true, "bannerText": "🌸 Spring Collection - Fresh Arrivals!", "bannerBackgroundColor": "330 80% 55%", "bannerTextColor": "0 0% 100%", "bannerDismissible": true, "badgeEnabled": true, "badgeText": "New Arrival", "badgeColor": "150 60% 50%", "categoryEmphasis": []},
        "emptyState": {"illustrationVariant": "seasonal", "messageTemplate": "Nothing has bloomed here yet... check back soon! 🌷"}
    }'::jsonb
WHERE name = 'Spring Bloom';

-- ============================================================================
-- INSERT SYSTEM PRESETS
-- ============================================================================

INSERT INTO theme_presets (name, type, description, config, is_system_preset)
VALUES 
    ('Calm & Gentle', 'microinteraction', 'Slow, smooth transitions for a calm feel', '{
        "durations": {"instant": 50, "fast": 180, "normal": 300, "slow": 500, "atmospheric": 2000},
        "timingFunction": "ease-in-out",
        "buttonHoverScale": 1.015,
        "buttonHoverLift": -1,
        "cardHoverScale": 1.005
    }'::jsonb, true),
    
    ('Snappy & Confident', 'microinteraction', 'Quick, bouncy interactions for energy', '{
        "durations": {"instant": 40, "fast": 120, "normal": 200, "slow": 350, "atmospheric": 1200},
        "timingFunction": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "buttonHoverScale": 1.03,
        "buttonHoverLift": -3,
        "cardHoverScale": 1.02,
        "toggleBounce": true
    }'::jsonb, true),
    
    ('Subtle Snowfall', 'atmosphere', 'Gentle white snow particles', '{
        "particles": {
            "type": "snowfall",
            "density": 25,
            "sizeMin": 3,
            "sizeMax": 8,
            "speedMin": 15,
            "speedMax": 40
        }
    }'::jsonb, true),
    
    ('Gentle Rain', 'atmosphere', 'Soft rain streaks for monsoon feel', '{
        "particles": {
            "type": "rain",
            "density": 40,
            "sizeMin": 1,
            "sizeMax": 2,
            "speedMin": 200,
            "speedMax": 400
        }
    }'::jsonb, true),
    
    ('Floating Petals', 'atmosphere', 'Delicate cherry blossom petals', '{
        "particles": {
            "type": "petals",
            "density": 20,
            "sizeMin": 8,
            "sizeMax": 16,
            "rotation": true,
            "drift": 25
        }
    }'::jsonb, true)
ON CONFLICT DO NOTHING;
