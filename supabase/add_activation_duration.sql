-- Add approved_until column for activation duration feature
-- Run this in Supabase SQL Editor

ALTER TABLE delivery_activations 
  ADD COLUMN IF NOT EXISTS approved_until TIMESTAMPTZ;

-- Add duration_hours column to track what the admin set
ALTER TABLE delivery_activations 
  ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 8;

COMMENT ON COLUMN delivery_activations.approved_until IS 'Timestamp when this activation expires';
COMMENT ON COLUMN delivery_activations.duration_hours IS 'Number of hours the activation is valid for';
