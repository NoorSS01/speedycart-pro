-- Security Audit Final Fixes
-- 1. ToS Consent Recording
-- 2. Delivery Time Configuration

-- Add ToS consent timestamp to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;

-- Create trigger to auto-record ToS acceptance when new profile is created
-- This ensures ToS timestamp is always recorded for new signups
CREATE OR REPLACE FUNCTION set_tos_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set tos_accepted_at if it's NULL (new signup)
  IF NEW.tos_accepted_at IS NULL THEN
    NEW.tos_accepted_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_tos_acceptance ON profiles;
CREATE TRIGGER trigger_set_tos_acceptance
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_tos_acceptance();

-- Add delivery time configuration to admin_settings
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS delivery_time_minutes INTEGER DEFAULT 30;

-- Set default delivery time for existing admin_settings row
UPDATE admin_settings
SET delivery_time_minutes = 30
WHERE id = '00000000-0000-0000-0000-000000000001'
AND delivery_time_minutes IS NULL;
