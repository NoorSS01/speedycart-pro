-- Add username column to profiles table
-- Username is optional but unique when set

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique 
ON profiles (LOWER(username)) 
WHERE username IS NOT NULL;

-- Add constraint for username format (alphanumeric, underscores, 3-20 chars)
ALTER TABLE profiles 
ADD CONSTRAINT check_username_format 
CHECK (
  username IS NULL OR 
  (
    LENGTH(username) >= 3 AND 
    LENGTH(username) <= 20 AND 
    username ~ '^[a-zA-Z0-9_]+$'
  )
);
