-- Add variant_id column to order_items table
-- This allows tracking which product variant was ordered

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);

-- Regenerate Supabase types after running this:
-- npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
