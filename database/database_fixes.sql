-- ============================================================
-- S&C Courier Services — Delivery Pipeline Fix
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor (or psql)
-- Makes delivery.book_id nullable so personal deliveries
-- can have delivery entries without a courier_req.
-- ============================================================

-- Make book_id nullable on delivery table
-- (Personal deliveries don't have a courier_req entry)
ALTER TABLE delivery ALTER COLUMN book_id DROP NOT NULL;
