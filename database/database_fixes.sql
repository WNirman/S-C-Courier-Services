-- ============================================================
-- S&C Courier Services — Delivery Pipeline Fix
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Make book_id nullable on delivery table
-- (Personal deliveries don't have a courier_req entry)
ALTER TABLE delivery ALTER COLUMN book_id DROP NOT NULL;

-- 2. Allow anon access to create trip and delivery records
ALTER TABLE trip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on trip" ON trip FOR ALL USING (true);

ALTER TABLE delivery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on delivery" ON delivery FOR ALL USING (true);

-- 3. Add tracking columns to delivery table so we can delete them if unassigned
ALTER TABLE delivery ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE delivery ADD COLUMN IF NOT EXISTS source_id INT;

-- 4. CRITICAL: Reload the Supabase API schema cache so it sees the new columns
NOTIFY pgrst, 'reload schema';
