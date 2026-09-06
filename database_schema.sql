-- ============================================================
-- S&C Courier Services - Complete Master Database Schema
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor → Click "Run"
--
-- ARCHITECTURE NOTES:
-- 1. Staff: Office & branch administration ONLY (NO vehicle or driver details).
-- 2. Rider: Dedicated delivery drivers for the MOBILE APP ONLY.
--    Primary Key: NIC (National Identity Card number).
-- 3. Trip: Links the dispatching staff member (created_by) to the mobile rider (rider_nic).
-- 4. Delivery: Tracks package transit and connects directly to the Trip.
-- ============================================================

-- 1. Customer
CREATE TABLE IF NOT EXISTS public.customer (
    customer_id SERIAL PRIMARY KEY,
    cust_name VARCHAR(100),
    cust_email VARCHAR(100) UNIQUE,
    cust_address TEXT,
    cust_phoneno VARCHAR(100) NOT NULL,
    cust_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cust_password TEXT
);

-- 2. Company
CREATE TABLE IF NOT EXISTS public.company (
    comp_id SERIAL PRIMARY KEY,
    comp_name VARCHAR(200) NOT NULL,
    comp_address TEXT NOT NULL,
    comp_phoneno VARCHAR(100) NOT NULL
);

-- 3. Department
CREATE TABLE IF NOT EXISTS public.department (
    dep_id SERIAL PRIMARY KEY,
    dep_name VARCHAR(100) NOT NULL,
    comp_id INT NOT NULL REFERENCES public.company(comp_id) ON DELETE CASCADE
);

-- 4. Client Approver
CREATE TABLE IF NOT EXISTS public.client_approver (
    approver_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(150) NOT NULL,
    signature_url TEXT,
    dep_id INT REFERENCES public.department(dep_id),
    cust_email VARCHAR(150) NOT NULL
);

-- 5. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    review_id SERIAL PRIMARY KEY,
    review_com TEXT,
    customer_id INT REFERENCES public.customer(customer_id) ON DELETE CASCADE
);

-- 6. Branch
CREATE TABLE IF NOT EXISTS public.branch (
    branch_id SERIAL PRIMARY KEY,
    branch_location TEXT NOT NULL
);

-- 7. Staff (Office & branch operations only — pure staff, no roles, no vehicle/rider data)
CREATE TABLE IF NOT EXISTS public.staff (
    staff_id SERIAL PRIMARY KEY,
    staff_name VARCHAR(200) NOT NULL,
    staff_phone VARCHAR(20) NOT NULL,
    branch_id INT NOT NULL REFERENCES public.branch(branch_id),
    staff_active_status BOOLEAN DEFAULT true,
    staff_email VARCHAR(150) UNIQUE NOT NULL,
    staff_password TEXT NOT NULL,
    staff_avatar_url TEXT
);

-- 8. Rider (Dedicated delivery fleet for the MOBILE APP — PK: NIC)
CREATE TABLE IF NOT EXISTS public.rider (
    NIC text NOT NULL PRIMARY KEY,
    Name text NOT NULL,
    Phone_Number text NOT NULL,
    Branch text,
    email text UNIQUE,
    password text NOT NULL,
    NIC_front text,
    NIC_back text,
    Address text,
    Emergency_Contact text,
    Vehicle_Type text,
    Vehicle_Number text,
    Driver_Licence_No text,
    current_lat double precision,
    current_lng double precision,
    availability_status text DEFAULT 'Available',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- 9. Invoice
CREATE TABLE IF NOT EXISTS public.invoice (
    invoice_id SERIAL PRIMARY KEY,
    invoice_type VARCHAR(100),
    customer_id INT REFERENCES public.customer(customer_id),
    issue_date DATE,
    billing_period_start DATE,
    billing_period_end DATE,
    total_amount NUMERIC(12,2),
    payment_status VARCHAR(100),
    rider_nic text REFERENCES public.rider(NIC) ON DELETE SET NULL
);

-- 10. Payment
CREATE TABLE IF NOT EXISTS public.payment (
    payment_id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES public.invoice(invoice_id) ON DELETE CASCADE,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(100),
    amount NUMERIC(12,2),
    status VARCHAR(100),
    transaction_id VARCHAR(150)
);

-- 11. ATR (Activity Travel Request)
CREATE TABLE IF NOT EXISTS public.atr (
    atr_id SERIAL PRIMARY KEY,
    dep_id INT NOT NULL REFERENCES public.department(dep_id),
    atr_number VARCHAR(50) UNIQUE NOT NULL,
    required_date DATE,
    required_time TIME,
    vehicle_type VARCHAR(50),
    purpose_of_travel TEXT,
    principal_passenger_name VARCHAR(100),
    principal_passenger_designation VARCHAR(100),
    estimated_distance NUMERIC(8,2),
    estimated_cost NUMERIC(10,2),
    actual_distance NUMERIC(8,2),
    actual_cost NUMERIC(10,2),
    status VARCHAR(100) DEFAULT 'Pending',
    approved_by INT REFERENCES public.staff(staff_id),
    approval_date TIMESTAMP,
    cust_email VARCHAR(150),
    approval_token VARCHAR(255),
    client_approver_id INT REFERENCES public.client_approver(approver_id),
    assigned_rider_nic text REFERENCES public.rider(NIC) ON DELETE SET NULL
);

-- 12. Trip (Links office staff dispatcher to mobile app rider)
CREATE TABLE IF NOT EXISTS public.trip (
    trip_id SERIAL PRIMARY KEY,
    trip_date DATE DEFAULT CURRENT_DATE,
    trip_status VARCHAR(100) DEFAULT 'scheduled',
    branch_id INT REFERENCES public.branch(branch_id),
    created_by INT REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    rider_nic text REFERENCES public.rider(NIC) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Receiver
CREATE TABLE IF NOT EXISTS public.receiver (
    rec_nic VARCHAR(100) PRIMARY KEY,
    rec_phone VARCHAR(20) NOT NULL,
    rec_name VARCHAR(100) NOT NULL,
    rec_location TEXT NOT NULL
);

-- 14. Courier Request
CREATE TABLE IF NOT EXISTS public.courier_req (
    book_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES public.customer(customer_id),
    rec_nic VARCHAR(100) NOT NULL REFERENCES public.receiver(rec_nic),
    atr_id INT REFERENCES public.atr(atr_id),
    courier_date DATE,
    courier_weight TEXT,
    status VARCHAR(100) DEFAULT 'Pending',
    assigned_staff_id INT REFERENCES public.staff(staff_id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Delivery (Tracks the parcel delivery under a dispatched trip)
CREATE TABLE IF NOT EXISTS public.delivery (
    del_id SERIAL PRIMARY KEY,
    delivery_status VARCHAR(100) DEFAULT 'assigned',
    pick_location TEXT,
    drop_location TEXT,
    book_id INT REFERENCES public.courier_req(book_id),
    trip_id INT NOT NULL REFERENCES public.trip(trip_id) ON DELETE CASCADE,
    source_type VARCHAR(50),
    source_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Notification
CREATE TABLE IF NOT EXISTS public.notification (
    notification_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES public.customer(customer_id),
    delivery_id INT NOT NULL REFERENCES public.delivery(del_id) ON DELETE CASCADE,
    notification_type VARCHAR(100),
    sent_date DATE DEFAULT CURRENT_DATE,
    notification_msg TEXT
);

-- 17. ATR Invoice Junction
CREATE TABLE IF NOT EXISTS public.atr_invoice (
    atr_id INT NOT NULL REFERENCES public.atr(atr_id) ON DELETE CASCADE,
    invoice_id INT NOT NULL REFERENCES public.invoice(invoice_id) ON DELETE CASCADE,
    PRIMARY KEY (atr_id, invoice_id)
);

-- 18. Personal Delivery (Customer portal door-to-door delivery)
CREATE TABLE IF NOT EXISTS public.personal_delivery (
    pd_id SERIAL PRIMARY KEY,
    cust_email TEXT,
    pickup_address TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION,
    pickup_lng DOUBLE PRECISION,
    drop_address TEXT NOT NULL,
    drop_lat DOUBLE PRECISION,
    drop_lng DOUBLE PRECISION,
    item_type TEXT NOT NULL,
    item_weight TEXT,
    item_description TEXT,
    sender_name TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    receiver_nic TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    requested_date DATE,
    requested_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_date DATE,
    scheduled_time TIME,
    schedule_token TEXT,
    assigned_rider_nic text REFERENCES public.rider(NIC) ON DELETE SET NULL,
    accepted_by TEXT,
    accepted_at TIMESTAMP
);

-- ============================================================
-- Safe Migrations for Existing Database (Ensures no missing columns)
-- ============================================================

-- Strip vehicle/rider columns from staff if present
ALTER TABLE public.staff DROP COLUMN IF EXISTS vehicle_type;
ALTER TABLE public.staff DROP COLUMN IF EXISTS vehicle_number;
ALTER TABLE public.staff DROP COLUMN IF EXISTS driver_licence_no;
ALTER TABLE public.staff DROP COLUMN IF EXISTS emergency_contact;

-- Ensure staff avatar
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS staff_avatar_url TEXT;

-- Ensure rider table columns for mobile app
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS current_lat double precision;
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS current_lng double precision;
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'Available';

-- Ensure delivery tracking columns
ALTER TABLE public.delivery ALTER COLUMN book_id DROP NOT NULL;
ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS source_type character varying(50);
ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS source_id integer;
ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS delivery_status character varying(100) DEFAULT 'assigned';

-- Ensure ATR & Personal Delivery rider assignments
ALTER TABLE public.atr ADD COLUMN IF NOT EXISTS assigned_rider_nic text;
ALTER TABLE public.atr ADD COLUMN IF NOT EXISTS cust_email character varying(150);
ALTER TABLE public.personal_delivery ADD COLUMN IF NOT EXISTS assigned_rider_nic text;

-- Ensure trip has rider_nic and created_by
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS rider_nic text;
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS created_by integer;

-- ============================================================
-- Essential Seed Data (Prevents foreign key issues)
-- ============================================================
INSERT INTO public.company (comp_name, comp_address, comp_phoneno)
VALUES ('SC Courier Services', 'Colombo, Sri Lanka', '+94 11 234 5678')
ON CONFLICT DO NOTHING;

INSERT INTO public.branch (branch_location)
VALUES ('Main Office')
ON CONFLICT DO NOTHING;

INSERT INTO public.department (dep_name, comp_id) VALUES
  ('Operations', 1), ('Finance', 1), ('Human Resources', 1),
  ('Logistics', 1), ('Administration', 1), ('IT', 1), ('Marketing', 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Permissions & PostgREST Schema Reload
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Allow_all_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', 'Allow_all_' || tbl, tbl);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
