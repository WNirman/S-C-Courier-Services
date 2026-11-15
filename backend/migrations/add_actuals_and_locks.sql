-- Migration: Add actual distance/cost and lock tracking columns for ATR and Personal Deliveries
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- 1. Corporate ATR: track locking metadata alongside existing actual_distance & actual_cost columns
ALTER TABLE atr
  ADD COLUMN IF NOT EXISTS actual_distance DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actuals_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS actuals_locked_by VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actuals_locked_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Personal / Private Delivery: add estimated & actual distance/cost plus lock tracking
ALTER TABLE personal_delivery
  ADD COLUMN IF NOT EXISTS estimated_distance DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_distance DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actuals_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS actuals_locked_by VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actuals_locked_at TIMESTAMPTZ DEFAULT NULL;
