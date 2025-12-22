-- Product Images Table
-- Allows multiple images per product

CREATE TABLE IF NOT EXISTS product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster product image lookups
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Ensure only one primary image per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary 
ON product_images(product_id) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view product images
CREATE POLICY "Anyone can view product images" ON product_images
    FOR SELECT USING (true);

-- Policy: Only admins can manage product images
CREATE POLICY "Admins can manage product images" ON product_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
