-- Fix for malicious activity false positives
-- The order total validation trigger is now redundant because place_order_atomic()
-- fetches all prices from the database. The trigger was designed to catch client-side
-- manipulation, but since we fixed that issue by using server-side prices, the trigger
-- now only creates false positives.

-- SOLUTION: Drop the trigger and function
-- The place_order_atomic() RPC already ensures price integrity

DROP TRIGGER IF EXISTS trigger_validate_order_total ON order_items;
DROP FUNCTION IF EXISTS validate_order_total_after_items();
DROP FUNCTION IF EXISTS calculate_order_total(UUID);

-- Note: We keep the order_status_transitions trigger as it's still valuable
-- That trigger validates status flow (pending -> confirmed -> delivered, etc.)
