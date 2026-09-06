-- ============================================================
-- S&C Courier Services - Complete Supabase Setup & Migration
-- ============================================================
-- Run this script in: Supabase Dashboard → SQL Editor → Click "Run"
-- Safe to run on both fresh and existing Supabase databases.
-- ============================================================

-- 1. CLEAN UP STAFF TABLE
-- (Remove vehicle & rider details — staff are office dispatchers/admins only)
ALTER TABLE public.staff DROP COLUMN IF EXISTS vehicle_type;
ALTER TABLE public.staff DROP COLUMN IF EXISTS vehicle_number;
ALTER TABLE public.staff DROP COLUMN IF EXISTS driver_licence_no;
ALTER TABLE public.staff DROP COLUMN IF EXISTS emergency_contact;

-- Ensure staff profile avatar column exists
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS staff_avatar_url TEXT;

-- Normalize staff_role to office roles ('staff' or 'admin', never 'rider')
UPDATE public.staff 
SET staff_role = 'staff' 
WHERE LOWER(staff_role) = 'rider' OR staff_role IS NULL;


-- 2. ENSURE RIDER TABLE HAS ALL COURIER & FLEET COLUMNS
CREATE TABLE IF NOT EXISTS public.rider (
    NIC text NOT NULL PRIMARY KEY,
    Name text NOT NULL,
    Phone_Number text,
    Branch text,
    email text UNIQUE,
    password text,
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

-- Ensure all columns exist if the table was created earlier
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS current_lat double precision;
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS current_lng double precision;
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.rider ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'Available';


-- 3. ENSURE TRIP TABLE CONNECTS DISPATCHING STAFF & ASSIGNED RIDER
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS rider_nic text;
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS branch_id integer;
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS trip_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS trip_status character varying DEFAULT 'scheduled';
ALTER TABLE public.trip ALTER COLUMN rider_id DROP NOT NULL;

-- Trip foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'trip_rider_nic_fkey' AND table_name = 'trip'
    ) THEN
        ALTER TABLE public.trip 
        ADD CONSTRAINT trip_rider_nic_fkey 
        FOREIGN KEY (rider_nic) REFERENCES public.rider(NIC) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'trip_created_by_fkey' AND table_name = 'trip'
    ) THEN
        ALTER TABLE public.trip 
        ADD CONSTRAINT trip_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.staff(staff_id) ON DELETE SET NULL;
    END IF;
END $$;


-- 4. ENSURE DELIVERY TABLE CONNECTS TO TRIP AND TRACKS SOURCE
ALTER TABLE public.delivery ALTER COLUMN book_id DROP NOT NULL;
ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS source_type character varying(50);
ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS source_id integer;
ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS delivery_status character varying(100) DEFAULT 'assigned';


-- 5. LINK ATR & PERSONAL DELIVERIES TO RIDER
ALTER TABLE public.atr ADD COLUMN IF NOT EXISTS cust_email character varying(150);
ALTER TABLE public.atr ADD COLUMN IF NOT EXISTS assigned_rider_nic text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'atr_assigned_rider_nic_fkey' AND table_name = 'atr'
    ) THEN
        ALTER TABLE public.atr 
        ADD CONSTRAINT atr_assigned_rider_nic_fkey 
        FOREIGN KEY (assigned_rider_nic) REFERENCES public.rider(NIC) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'personal_delivery_assigned_rider_nic_fkey' AND table_name = 'personal_delivery'
    ) THEN
        ALTER TABLE public.personal_delivery 
        ADD CONSTRAINT personal_delivery_assigned_rider_nic_fkey 
        FOREIGN KEY (assigned_rider_nic) REFERENCES public.rider(NIC) ON DELETE SET NULL;
    END IF;
END $$;


-- 6. PERMISSIONS & POSTGREST SCHEMA RELOAD
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Open RLS policies so frontend and backend operations succeed
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
