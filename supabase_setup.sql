-- ================================================
-- SC Courier Services — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS customer (
    customer_id SERIAL PRIMARY KEY,
    cust_name VARCHAR(100),
    cust_email VARCHAR(100),
    cust_address TEXT,
    cust_phoneno VARCHAR(100) NOT NULL,
    cust_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cust_password TEXT
);

CREATE TABLE IF NOT EXISTS company(
    comp_id SERIAL PRIMARY KEY,
    comp_name VARCHAR(200) NOT NULL,
    comp_address TEXT NOT NULL,
    comp_phoneno VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS department(
    dep_id SERIAL PRIMARY KEY,
    dep_name VARCHAR(100) NOT NULL,
    comp_id INT NOT NULL,
    FOREIGN KEY (comp_id) REFERENCES company(comp_id)
);

CREATE TABLE IF NOT EXISTS reviews(
    review_id SERIAL PRIMARY KEY,
    review_com TEXT,
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);

CREATE TABLE IF NOT EXISTS branch(
    branch_id SERIAL PRIMARY KEY,
    branch_location TEXT
);

CREATE TABLE IF NOT EXISTS staff(
    staff_id SERIAL PRIMARY KEY,
    staff_name VARCHAR(200) NOT NULL,
    staff_phone VARCHAR(12) NOT NULL,
    branch_id INT NOT NULL,
    staff_role VARCHAR(100),
    staff_active_status BOOLEAN,
    FOREIGN KEY(branch_id) REFERENCES branch(branch_id),
    staff_email VARCHAR(150) UNIQUE,
    staff_password TEXT
);

CREATE TABLE IF NOT EXISTS invoice (
    invoice_id SERIAL PRIMARY KEY,
    invoice_type VARCHAR(100),
    customer_id INT,
    rider_id INT,
    issue_date DATE,
    billing_period_start DATE,
    billing_period_end DATE,
    total_amount DECIMAL(12,2),
    payment_status VARCHAR(100),
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    FOREIGN KEY (rider_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS payment (
    payment_id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL,
    payment_date TIMESTAMP,
    payment_method VARCHAR(100),
    amount DECIMAL(12,2),
    status VARCHAR(100),
    transaction_id VARCHAR(150),
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
);

CREATE TABLE IF NOT EXISTS atr (
    atr_id SERIAL PRIMARY KEY,
    dep_id INT NOT NULL,
    atr_number VARCHAR(50) UNIQUE NOT NULL,
    required_date DATE,
    required_time TIME,
    vehicle_type VARCHAR(50),
    purpose_of_travel TEXT,
    principal_passenger_name VARCHAR(100),
    principal_passenger_designation VARCHAR(100),
    estimated_distance DECIMAL(8,2),
    estimated_cost DECIMAL(10,2),
    actual_distance DECIMAL(8,2),
    actual_cost DECIMAL(10,2),
    status VARCHAR(100),
    approved_by INT,
    approval_date TIMESTAMP,
    FOREIGN KEY (dep_id) REFERENCES department(dep_id),
    FOREIGN KEY (approved_by) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS trip(
    trip_id SERIAL PRIMARY KEY,
    rider_id INT NOT NULL,
    trip_date DATE,
    trip_status VARCHAR(100),
    FOREIGN KEY(rider_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS receiver(
    rec_nic VARCHAR(100) PRIMARY KEY,
    rec_phone VARCHAR(12) NOT NULL,
    rec_name VARCHAR(70) NOT NULL,
    rec_location VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS courier_req(
    book_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    rec_nic VARCHAR(100) NOT NULL,
    atr_id INT NOT NULL,
    courier_date DATE,
    courier_weight TEXT,
    status VARCHAR(100),
    FOREIGN KEY(customer_id) REFERENCES customer(customer_id),
    FOREIGN KEY(rec_nic) REFERENCES receiver(rec_nic),
    FOREIGN KEY(atr_id) REFERENCES atr(atr_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery (
    del_id SERIAL PRIMARY KEY,
    delivery_status VARCHAR(100),
    pick_location TEXT,
    drop_location TEXT,
    book_id INT NOT NULL REFERENCES courier_req(book_id),
    trip_id INT NOT NULL REFERENCES trip(trip_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification(
    notification_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    delivery_id INT NOT NULL,
    notification_type VARCHAR(100),
    sent_date DATE,
    notification_msg TEXT,
    FOREIGN KEY(delivery_id) REFERENCES delivery(del_id),
    FOREIGN KEY(customer_id) REFERENCES customer(customer_id)
);

-- ================================================
-- Seed Data (required for foreign key constraints)
-- ================================================

INSERT INTO company (comp_name, comp_address, comp_phoneno)
VALUES ('SC Courier Services', 'Colombo, Sri Lanka', '+94 11 234 5678')
ON CONFLICT DO NOTHING;

INSERT INTO branch (branch_location)
VALUES ('Main Office')
ON CONFLICT DO NOTHING;

INSERT INTO department (dep_name, comp_id) VALUES
  ('Operations', 1), ('Finance', 1), ('Human Resources', 1),
  ('Logistics', 1), ('Administration', 1), ('IT', 1), ('Marketing', 1)
ON CONFLICT DO NOTHING;

-- ================================================
-- Disable RLS on tables used by the frontend
-- (Supabase enables RLS by default, which blocks anon access)
-- ================================================

ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE department ENABLE ROW LEVEL SECURITY;
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE atr ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_avatar_url TEXT;

-- Create policies to allow anon access (for the frontend client)
CREATE POLICY "Allow anon select on customer" ON customer FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on customer" ON customer FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on customer" ON customer FOR UPDATE USING (true);

CREATE POLICY "Allow anon select on staff" ON staff FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on staff" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon delete on staff" ON staff FOR DELETE USING (true);

CREATE POLICY "Allow anon select on branch" ON branch FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on branch" ON branch FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon select on department" ON department FOR SELECT USING (true);

CREATE POLICY "Allow anon select on company" ON company FOR SELECT USING (true);

CREATE POLICY "Allow anon all on atr" ON atr FOR ALL USING (true);
CREATE POLICY "Allow anon update on staff" ON staff FOR UPDATE USING (true);
