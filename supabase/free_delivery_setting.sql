-- Add free delivery threshold to app_settings
INSERT INTO app_settings (key, value, description) VALUES
    ('free_delivery_threshold', '499', 'Minimum order amount for free delivery in INR')
ON CONFLICT (key) DO NOTHING;
