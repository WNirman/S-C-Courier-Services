-- Migration: Add latitude/longitude columns to personal_delivery table
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- These columns store the geocoded coordinates for pickup and drop locations
-- so the mobile app can display routes on a map.

ALTER TABLE personal_delivery
  ADD COLUMN IF NOT EXISTS pickup_lat  DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pickup_lng  DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drop_lat    DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drop_lng    DOUBLE PRECISION DEFAULT NULL;

-- Optional: add a comment describing the columns
COMMENT ON COLUMN personal_delivery.pickup_lat  IS 'Latitude of the pickup location (WGS-84)';
COMMENT ON COLUMN personal_delivery.pickup_lng  IS 'Longitude of the pickup location (WGS-84)';
COMMENT ON COLUMN personal_delivery.drop_lat    IS 'Latitude of the drop/destination location (WGS-84)';
COMMENT ON COLUMN personal_delivery.drop_lng    IS 'Longitude of the drop/destination location (WGS-84)';

