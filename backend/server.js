require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect((err) => {
  if (err) {
    console.error('Database connection error (Check your password in .env!):', err.stack);
  } else {
    console.log('Connected to PostgreSQL successfully!');
  }
});

// Basic Test Route
app.get('/', (req, res) => {
  res.send('SC Courier Backend API is running.');
});

// --- AUTHENTICATION ROUTES --- //

// Auth: Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    // 1. Check Admin Hardcode 
    if (email === 'admin@sccourier.com' && password === 'admin123') {
      return res.json({ role: 'admin', name: 'Administrator' });
    }

    // 2. Check Staff Table
    const staffCheck = await pool.query('SELECT * FROM Staff WHERE staff_email = $1', [email]);
    if (staffCheck.rows.length > 0) {
      if (staffCheck.rows[0].staff_password === password) {
        return res.json({ role: 'staff', name: staffCheck.rows[0].staff_name });
      } else {
        return res.status(401).json({ error: 'Incorrect staff password' });
      }
    }

    // 3. Check Customer Table
    const custCheck = await pool.query('SELECT * FROM Customer WHERE cust_email = $1', [email]);
    if (custCheck.rows.length > 0) {
      if (custCheck.rows[0].cust_password === password) {
        return res.json({ role: 'customer', name: custCheck.rows[0].cust_name });
      } else {
        return res.status(401).json({ error: 'Incorrect customer password' });
      }
    }

    // Not found
    res.status(404).json({ error: 'User not found in system' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Auth: Customer Registration
app.post('/api/auth/register', async (req, res) => {
  const { name, email, address, phone, password } = req.body;

  // Basic Server-Side Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT * FROM Customer WHERE cust_email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered!' });
    }

    const newCust = await pool.query(
      `INSERT INTO Customer (cust_name, cust_email, cust_address, cust_phoneNo, cust_type, cust_password)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, address || 'N/A', phone, 'Regular', password]
    );
    res.json(newCust.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error during registration' });
  }
});

// ----------------------------- //

// Admin Route: Get all assigned staff
app.get('/api/admin/staff', async (req, res) => {
  try {
    const result = await pool.query("SELECT staff_email FROM Staff WHERE staff_role = 'staff'");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Route: Assign a new staff member
app.post('/api/admin/staff', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Server-Side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user exists
    const checkStaff = await pool.query('SELECT * FROM Staff WHERE staff_email = $1', [email]);
    if (checkStaff.rows.length > 0) {
      return res.status(400).json({ error: 'Staff member already assigned' });
    }

    // Fetch existing customer details to preserve their name, phone, and password.
    // Admin can ONLY assign staff members that have already registered.
    const checkCustomer = await pool.query('SELECT * FROM Customer WHERE cust_email = $1', [email]);

    if (checkCustomer.rows.length === 0) {
      return res.status(404).json({ error: 'User is not registered. Cannot assign as staff.' });
    }

    const cust = checkCustomer.rows[0];
    const staffName = cust.cust_name || 'New Staff';
    // PostgreSQL converts column names to lowercase by default
    const staffPhone = cust.cust_phoneno || cust.cust_phoneNo || '555-0000';
    const staffPassword = cust.cust_password;

    // Ensure at least one Branch exists so the Foreign Key doesn't fail!
    const branchCheck = await pool.query('SELECT branch_ID FROM Branch LIMIT 1');
    let dbBranchId = 1;
    if (branchCheck.rows.length === 0) {
      const newBranch = await pool.query("INSERT INTO Branch (branch_location) VALUES ('Main Office') RETURNING branch_ID");
      dbBranchId = newBranch.rows[0].branch_id;
    } else {
      dbBranchId = branchCheck.rows[0].branch_id;
    }

    // Insert staff using actual details (if they were a customer) or default generics
    const newStaff = await pool.query(
      `INSERT INTO Staff (staff_name, staff_email, staff_phone, branch_id, staff_role, staff_active_status, staff_password) 
       VALUES ($1, $2, $3, $4, 'staff', true, $5) RETURNING *`,
      [staffName, email, staffPhone, dbBranchId, staffPassword]
    );

    res.json(newStaff.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Route: Delete a staff member
app.delete('/api/admin/staff/:email', async (req, res) => {
  try {
    const { email } = req.params;
    await pool.query('DELETE FROM Staff WHERE staff_email = $1', [email]);
    res.json({ message: 'Staff removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during deletion' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

app.get('/api/admin/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Execute query to check if admin details exist in Staff table
    const result = await pool.query(
      'SELECT staff_name, staff_email, staff_phone, staff_avatar_url FROM Staff WHERE staff_email = $1',
      [email]
    );

    // If hardcoded admin hasn't interacted with database yet, return standard values
    if (result.rows.length === 0 && email === 'admin@sccourier.com') {
      return res.json({
        staff_name: 'Administrator',
        staff_email: 'admin@sccourier.com',
        staff_phone: '+94 11 234 5678',
        staff_avatar_url: 'https://via.placeholder.com/150'
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching profile data' });
  }
});

app.put('/api/admin/profile', async (req, res) => {
  try {
    const { email, name, phone, avatarUrl } = req.body;

    // Check if the admin already has a row in the database
    const checkAdmin = await pool.query('SELECT * FROM Staff WHERE staff_email = $1', [email]);

    if (checkAdmin.rows.length === 0) {
      // Get the default office branch ID to prevent breaking foreign keys
      const branchCheck = await pool.query('SELECT branch_id FROM Branch LIMIT 1');
      const dbBranchId = branchCheck.rows.length > 0 ? branchCheck.rows[0].branch_id : 1;

      // Insert new profile row into Staff for the hardcoded admin
      await pool.query(
        `INSERT INTO Staff (staff_name, staff_email, staff_phone, branch_id, staff_role, staff_active_status, staff_password, staff_avatar_url) 
         VALUES ($1, $2, $3, $4, 'admin', true, 'admin123', $5)`,
        [name, email, phone, dbBranchId, avatarUrl]
      );
    } else {
      // Update existing admin/staff profile row
      await pool.query(
        `UPDATE Staff 
         SET staff_name = $1, staff_phone = $2, staff_avatar_url = $3 
         WHERE staff_email = $4`,
        [name, phone, avatarUrl, email]
      );
    }

    res.json({ message: 'Profile updated successfully!', avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while saving profile data' });
  }
});