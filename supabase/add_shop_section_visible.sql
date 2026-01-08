-- Add shop_section_visible column to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS shop_section_visible BOOLEAN DEFAULT TRUE;

-- Update existing records to have true by default
UPDATE categories 
SET shop_section_visible = TRUE 
WHERE shop_section_visible IS NULL;
