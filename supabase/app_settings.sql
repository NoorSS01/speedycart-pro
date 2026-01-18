-- App Settings Table for storing application-wide configuration
-- This stores settings like free delivery threshold that admins can change

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read app settings
CREATE POLICY "App settings are readable by all" ON app_settings
    FOR SELECT USING (true);

-- Only admins can modify app settings
CREATE POLICY "Only admins can modify app settings" ON app_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Insert default free delivery threshold if not exists
INSERT INTO app_settings (key, value, description)
VALUES ('free_delivery_threshold', '499', 'Minimum order amount for free delivery in INR')
ON CONFLICT (key) DO NOTHING;
