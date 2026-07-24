-- ================================================
-- SC Courier Services — Delivery Scheduling Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ================================================

-- 1. Create the Rider table (for dedicated courier riders)
CREATE TABLE IF NOT EXISTS rider (
    nic              VARCHAR(20) PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    phone_number     VARCHAR(20) NOT NULL,
    branch           VARCHAR(100),
    email            VARCHAR(100) UNIQUE NOT NULL,
    password         VARCHAR(255) NOT NULL,
    nic_front_image  VARCHAR(255),
    nic_back_image   VARCHAR(255),
    address          TEXT,
    emergency_contact VARCHAR(20),
    vehicle_type     VARCHAR(50),
    vehicle_no       VARCHAR(50),
    driver_licence_no VARCHAR(50),
    -- New: Location & availability for proximity-based assignment
    current_lat      DOUBLE PRECISION,
    current_lng      DOUBLE PRECISION,
    availability_status VARCHAR(50) DEFAULT 'Available',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RLS + open access for the rider table
ALTER TABLE rider ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on rider" ON rider FOR ALL USING (true);

-- 2. Add scheduling & assignment columns to personal_delivery
ALTER TABLE personal_delivery ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE personal_delivery ADD COLUMN IF NOT EXISTS scheduled_time TIME;
ALTER TABLE personal_delivery ADD COLUMN IF NOT EXISTS schedule_token VARCHAR(255);
ALTER TABLE personal_delivery ADD COLUMN IF NOT EXISTS assigned_rider_nic VARCHAR(20) REFERENCES rider(nic);
ALTER TABLE personal_delivery ADD COLUMN IF NOT EXISTS accepted_by VARCHAR(150);
ALTER TABLE personal_delivery ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
