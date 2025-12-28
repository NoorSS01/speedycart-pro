-- Delivery Ratings Table
-- This table stores ratings given by users to delivery partners after each delivery

CREATE TABLE IF NOT EXISTS delivery_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    delivery_person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_delivery_person ON delivery_ratings(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_order ON delivery_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_user ON delivery_ratings(user_id);

-- Enable RLS
ALTER TABLE delivery_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can insert their own ratings
CREATE POLICY "Users can insert own ratings" ON delivery_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own ratings
CREATE POLICY "Users can view own ratings" ON delivery_ratings
    FOR SELECT USING (auth.uid() = user_id);

-- Delivery partners can view ratings they received
CREATE POLICY "Delivery partners can view their ratings" ON delivery_ratings
    FOR SELECT USING (auth.uid() = delivery_person_id);

-- Admins can view all ratings (using existing has_role function)
CREATE POLICY "Admins can view all ratings" ON delivery_ratings
    FOR SELECT USING (
        has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
    );
