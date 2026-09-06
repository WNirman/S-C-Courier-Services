-- ============================================================
-- S&C Courier Services - Strip staff_role and personal columns
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → Click "Run"
-- ============================================================

-- 1. Drop staff_role and unnecessary personal columns from staff
ALTER TABLE public.staff DROP COLUMN IF EXISTS staff_role;
ALTER TABLE public.staff DROP COLUMN IF EXISTS staff_dob;
ALTER TABLE public.staff DROP COLUMN IF EXISTS staff_nic;
ALTER TABLE public.staff DROP COLUMN IF EXISTS staff_address;

-- 2. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
