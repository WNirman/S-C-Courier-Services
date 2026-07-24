const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });
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
      const staffUser = staffCheck.rows[0];
      const dbPassword = staffUser.staff_password;

      // Determine if dbPassword is a 64-char hex SHA-256 hash
      const isHashed = dbPassword && dbPassword.length === 64 && /^[0-9a-f]+$/i.test(dbPassword);
      let passwordToCompare = password;
      if (isHashed) {
        const crypto = require('crypto');
        passwordToCompare = crypto.createHash('sha256').update(password).digest('hex');
      }

      if (dbPassword === passwordToCompare) {
        if (staffUser.staff_active_status === false) {
          return res.status(403).json({ error: 'Account is inactive. Access denied.' });
        }
        return res.json({ role: 'staff', name: staffUser.staff_name });
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

// Admin Route: Assign a new staff member (simplified registration form)
app.post('/api/admin/staff', async (req, res) => {
  try {
    const { name, phone, role, branchId } = req.body;
    if (!name || !phone || !role || !branchId) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const phoneTrimmed = phone.trim();
    if (phoneTrimmed.length < 9 || phoneTrimmed.length > 15 || !/^\+?[0-9]+$/.test(phoneTrimmed)) {
      return res.status(400).json({ error: 'Invalid contact number format' });
    }

    // Check duplicate phone in Staff table
    const phoneCheck = await pool.query('SELECT * FROM Staff WHERE staff_phone = $1', [phoneTrimmed]);
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Contact Number is already in use by another staff member' });
    }

    // Generate unique username: first name + @sccourier.com
    const baseName = name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = baseName || 'staff';
    const domain = '@sccourier.com';
    let generatedUsername = `${base}${domain}`;

    // Get all existing staff emails starting with base
    const matchingEmails = await pool.query('SELECT staff_email FROM Staff WHERE staff_email LIKE $1', [`${base}%${domain}`]);
    const existingUsernames = matchingEmails.rows.map(r => r.staff_email);
    
    let counter = 1;
    while (existingUsernames.includes(generatedUsername)) {
      generatedUsername = `${base}${counter}${domain}`;
      counter++;
    }

    // Generate secure temporary password
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '@#$%&*!';
    const getRandom = (set, count) => {
      let r = '';
      for (let i = 0; i < count; i++) {
        r += set.charAt(Math.floor(Math.random() * set.length));
      }
      return r;
    };
    let rawPassword = getRandom(uppercase, 2) + getRandom(lowercase, 2) + getRandom(numbers, 2) + getRandom(symbols, 2);
    // Shuffle
    const tempPassword = rawPassword.split('').sort(() => Math.random() - 0.5).join('');

    // Encrypt password (SHA-256)
    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(tempPassword).digest('hex');

    // Insert staff
    const result = await pool.query(
      `INSERT INTO Staff (
        staff_name, staff_phone, branch_id, staff_role, staff_active_status, 
        staff_email, staff_password
      ) VALUES ($1, $2, $3, $4, true, $5, $6) RETURNING *`,
      [name, phoneTrimmed, branchId, role, generatedUsername, hashedPassword]
    );

    res.json({
      staff: result.rows[0],
      generatedUsername,
      tempPassword
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during staff assignment' });
  }
});

// Admin Route: Send generated credentials via email
app.post('/api/admin/send-staff-credentials', async (req, res) => {
  const { personalEmail, username, password, staffName } = req.body;
  if (!personalEmail || !username || !password) {
    return res.status(400).json({ error: 'Missing personalEmail, username, or password' });
  }

  const mailOptions = {
    from: `"SC Courier Services" <${process.env.SMTP_USER || 'no-reply@sccourier.com'}>`,
    to: personalEmail,
    subject: 'SC Courier Services — Your Staff Account Credentials',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ea580c; font-size: 24px; font-weight: 700; margin: 0;">SC Courier Services</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">Staff Account Registration</p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p>Dear <strong>${staffName || 'Staff Member'}</strong>,</p>
          <p>Welcome to the team! Your staff account has been successfully created. You can now access the Staff Dashboard using the temporary credentials provided below:</p>
          
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 24px 0; font-family: monospace; font-size: 16px; color: #111827;">
            <div style="margin-bottom: 10px;"><strong>Username:</strong> ${username}</div>
            <div><strong>Temporary Password:</strong> ${password}</div>
          </div>
          
          <p style="color: #ef4444; font-size: 13px; font-weight: 600; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px;">
            ⚠️ Security Reminder: Please change your password immediately after your first login to ensure account security.
          </p>
          
          <p style="margin-top: 24px; font-size: 14px; color: #4b5563; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            If you did not request this account, please contact the System Administrator.
          </p>
          <p style="font-size: 14px; color: #4b5563; margin-top: 10px;">
            Regards,<br><strong>SC Courier Services Team</strong>
          </p>
        </div>
      </div>
    `
  };

  try {
    if (!transporter) {
      await setupTransporter();
    }
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    res.json({ message: 'Email sent successfully!', previewUrl });
  } catch (err) {
    console.error('Error sending credentials email:', err);
    res.status(500).json({ error: 'Failed to send credentials email. Check SMTP configuration.' });
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

// --- ATR EMAIL APPROVALS --- //
const nodemailer = require('nodemailer');

// Setup Nodemailer Transporter
let transporter;
const setupTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('SMTP Email transporter configured successfully.');
  } else {
    // Generate test SMTP service account from ethereal.email
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Ethereal Test SMTP transporter configured (No SMTP settings found in .env).');
      console.log(`Ethereal Test Account User: ${testAccount.user}`);
    } catch (err) {
      console.error('Failed to create Ethereal SMTP test account:', err);
    }
  }
};
setupTransporter();

// POST Route: Send approval email to pre-assigned client approver
app.post('/api/atr/send-approval-email', async (req, res) => {
  const { atrId } = req.body;
  if (!atrId) return res.status(400).json({ error: 'atrId is required' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // Fetch ATR row from Supabase
    const atrRes = await fetch(
      `${SUPABASE_URL}/rest/v1/atr?atr_id=eq.${atrId}&select=*`,
      { headers }
    );
    const atrRows = await atrRes.json();
    if (!atrRows || atrRows.length === 0) {
      return res.status(404).json({ error: 'ATR request not found' });
    }
    const atr = atrRows[0];

    if (!atr.client_approver_id) {
      return res.status(400).json({ error: 'No external approver assigned to this ATR' });
    }

    // Fetch approver details from Supabase
    const approverRes = await fetch(
      `${SUPABASE_URL}/rest/v1/client_approver?approver_id=eq.${atr.client_approver_id}&select=*`,
      { headers }
    );
    const approverRows = await approverRes.json();
    if (!approverRows || approverRows.length === 0) {
      return res.status(400).json({ error: 'Approver not found' });
    }
    const approver = approverRows[0];

    // Fetch department name
    let depName = 'N/A';
    if (atr.dep_id) {
      const depRes = await fetch(
        `${SUPABASE_URL}/rest/v1/department?dep_id=eq.${atr.dep_id}&select=dep_name`,
        { headers }
      );
      const depRows = await depRes.json();
      if (depRows && depRows.length > 0) depName = depRows[0].dep_name;
    }

    // Format fields
    const formattedDate = atr.required_date ? new Date(atr.required_date).toLocaleDateString() : 'N/A';
    const formattedTime = atr.required_time || 'N/A';
    const passengerInfo = `${atr.principal_passenger_name} (${atr.principal_passenger_designation})`;
    const distanceInfo = `${atr.estimated_distance} km`;
    const costInfo = `LKR ${atr.estimated_cost}`;


    // Construct Magic URLs
    const baseUrl = `http://localhost:${port}`;
    const approveUrl = `${baseUrl}/api/atr/respond?token=${atr.approval_token}&action=approve`;
    const rejectUrl = `${baseUrl}/api/atr/respond?token=${atr.approval_token}&action=reject`;

    // Use fetched approver details
    const approverName = approver.name;
    const approverEmail = approver.email;

    // Modern, Premium email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ATR Approval Request</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }
          .container {
            max-width: 600px;
            background-color: #ffffff;
            margin: 0 auto;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #1e3a8a, #3b82f6);
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .details-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          .details-table td.label {
            font-weight: 600;
            color: #4b5563;
            width: 40%;
          }
          .details-table td.value {
            color: #1f2937;
          }
          .actions {
            margin-top: 30px;
            text-align: center;
          }
          .btn {
            display: inline-block;
            text-align: center;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            margin: 0 10px;
            min-width: 140px;
          }
          .btn-approve {
            background-color: #10b981;
            color: #ffffff !important;
          }
          .btn-approve:hover {
            background-color: #059669;
          }
          .btn-reject {
            background-color: #ef4444;
            color: #ffffff !important;
          }
          .btn-reject:hover {
            background-color: #dc2626;
          }
          .footer {
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Transport Request Approval</h1>
            <p>ATR Request Reference: ${atr.atr_number}</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${approverName},</div>
            <p>A new transport request has been submitted that requires your authoritative approval. Please review the details below:</p>
            
            <table class="details-table">
              <tr>
                <td class="label">ATR Number</td>
                <td class="value">${atr.atr_number}</td>
              </tr>
              <tr>
                <td class="label">Department</td>
                <td class="value">${depName}</td>
              </tr>
              <tr>
                <td class="label">Required Date</td>
                <td class="value">${formattedDate}</td>
              </tr>
              <tr>
                <td class="label">Required Time</td>
                <td class="value">${formattedTime}</td>
              </tr>
              <tr>
                <td class="label">Vehicle Type</td>
                <td class="value">${atr.vehicle_type}</td>
              </tr>
              <tr>
                <td class="label">Principal Passenger</td>
                <td class="value">${passengerInfo}</td>
              </tr>
              <tr>
                <td class="label">Purpose of Travel</td>
                <td class="value">${atr.purpose_of_travel}</td>
              </tr>
              <tr>
                <td class="label">Estimated Distance</td>
                <td class="value">${distanceInfo}</td>
              </tr>
              <tr>
                <td class="label">Estimated Cost</td>
                <td class="value">${costInfo}</td>
              </tr>
            </table>

            <p style="font-weight: 500; text-align: center; margin-bottom: 20px;">Please click one of the buttons below to approve or reject this request:</p>
            
            <div class="actions">
              <a href="${approveUrl}" class="btn btn-approve">Approve Request</a>
              <a href="${rejectUrl}" class="btn btn-reject">Reject Request</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated request from SC Courier Services on behalf of your company.</p>
            <p>&copy; 2026 SC Courier Services. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"SC Courier Services" <${process.env.SMTP_USER}>`,
      to: approverEmail,
      subject: `[Pending Approval] Transport Request - ${atr.atr_number}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Approval email sent to ${approverEmail} (ATR: ${atr.atr_number})`);

    // If using Ethereal, log preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Email Preview URL: ${previewUrl}`);
      return res.json({ message: 'Approval email sent successfully (Ethereal test mode)', previewUrl });
    }

    res.json({ message: 'Approval email sent successfully' });
  } catch (err) {
    console.error('Error sending approval email:', err);
    res.status(500).json({ error: 'Server error while sending approval email' });
  }
});

// GET Route: Process approver response (magic link click)
app.get('/api/atr/respond', async (req, res) => {
  const { token, action } = req.query;

  if (!token || !action) {
    return res.status(400).send('<h1>Invalid Request</h1><p>Missing parameters.</p>');
  }

  const isApprove = action === 'approve';
  const isReject = action === 'reject';

  if (!isApprove && !isReject) {
    return res.status(400).send('<h1>Invalid Action</h1><p>Action must be approve or reject.</p>');
  }

  const SUPABASE_URL2 = process.env.SUPABASE_URL;
  const SUPABASE_KEY2 = process.env.SUPABASE_ANON_KEY;
  const sbHeaders = {
    'apikey': SUPABASE_KEY2,
    'Authorization': `Bearer ${SUPABASE_KEY2}`,
    'Content-Type': 'application/json'
  };

  try {
    // Find the ATR matching this approval token via Supabase REST
    const atrRes = await fetch(
      `${SUPABASE_URL2}/rest/v1/atr?approval_token=eq.${encodeURIComponent(token)}&select=*`,
      { headers: sbHeaders }
    );
    const atrRows = await atrRes.json();

    if (!atrRows || atrRows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Expired</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f3f4f6; color: #1f2937; }
            .card { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Link Invalid or Expired</h1>
            <p>The approval token provided is invalid or has expired.</p>
          </div>
        </body>
        </html>
      `);
    }

    const atrData = atrRows[0];

    // Fetch approver name for display
    let approverName = 'N/A';
    if (atrData.client_approver_id) {
      const apRes = await fetch(
        `${SUPABASE_URL2}/rest/v1/client_approver?approver_id=eq.${atrData.client_approver_id}&select=name`,
        { headers: sbHeaders }
      );
      const apRows = await apRes.json();
      if (apRows && apRows.length > 0) approverName = apRows[0].name;
    }

    // Check if already processed
    if (atrData.status === 'Approved' || atrData.status === 'Rejected') {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Request Already Processed</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f3f4f6; color: #1f2937; }
            .card { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #3b82f6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Already Processed</h1>
            <p>This request for <strong>${atrData.atr_number}</strong> has already been marked as <strong>${atrData.status}</strong>.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Update ATR status in Supabase
    const targetStatus = isApprove ? 'Approved' : 'Rejected';
    await fetch(
      `${SUPABASE_URL2}/rest/v1/atr?approval_token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: targetStatus, approval_date: new Date().toISOString() })
      }
    );

    // Sleek and beautiful success screen
    const accentColor = isApprove ? '#10b981' : '#ef4444';
    const statusLabel = isApprove ? 'Approved' : 'Rejected';
    const icon = isApprove 
      ? `<svg style="width:80px;height:80px;color:#10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
      : `<svg style="width:80px;height:80px;color:#ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Response Recorded</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 40px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 80vh;
          }
          .card {
            background-color: #ffffff;
            max-width: 500px;
            width: 100%;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            text-align: center;
          }
          .icon-container { margin-bottom: 24px; }
          h1 { color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
          .status-badge {
            display: inline-block;
            background-color: ${isApprove ? '#ecfdf5' : '#fef2f2'};
            color: ${accentColor};
            padding: 6px 16px; border-radius: 9999px;
            font-weight: 600; font-size: 14px; margin-bottom: 24px;
          }
          .details {
            background-color: #f9fafb; border: 1px solid #e5e7eb;
            border-radius: 8px; padding: 16px; text-align: left;
            margin-bottom: 24px; font-size: 14px;
          }
          .details-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .details-row:last-child { margin-bottom: 0; }
          .label { color: #6b7280; font-weight: 500; }
          .value { color: #1f2937; font-weight: 600; }
          p.footer-note { color: #9ca3af; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-container">${icon}</div>
          <h1>Request Decided</h1>
          <div class="status-badge">${statusLabel}</div>
          <div class="details">
            <div class="details-row">
              <span class="label">ATR Number:</span>
              <span class="value">${atrData.atr_number}</span>
            </div>
            <div class="details-row">
              <span class="label">Passenger:</span>
              <span class="value">${atrData.principal_passenger_name}</span>
            </div>
            <div class="details-row">
              <span class="label">Approver:</span>
              <span class="value">${approverName}</span>
            </div>
            <div class="details-row">
              <span class="label">Date Processed:</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
          </div>
          <p class="footer-note">This decision has been securely recorded. You can now close this tab.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error processing ATR response:', err);
    res.status(500).send('<h1>Server Error</h1><p>An error occurred while processing your response.</p>');
  }
});

// POST Route: Send email to customer when rider is assigned
app.post('/api/atr/send-assignment-email', async (req, res) => {
  const { atrId, riderId } = req.body;
  if (!atrId || !riderId) return res.status(400).json({ error: 'atrId and riderId are required' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // Fetch ATR row
    const atrRes = await fetch(
      `${SUPABASE_URL}/rest/v1/atr?atr_id=eq.${atrId}&select=*`,
      { headers }
    );
    const atrRows = await atrRes.json();
    if (!atrRows || atrRows.length === 0) {
      return res.status(404).json({ error: 'ATR request not found' });
    }
    const atr = atrRows[0];
    
    const customerEmail = atr.cust_email;
    if (!customerEmail) {
      return res.status(400).json({ error: 'No customer email found for this ATR' });
    }

    // Fetch rider details
    const riderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff?staff_id=eq.${riderId}&select=*`,
      { headers }
    );
    const riderRows = await riderRes.json();
    if (!riderRows || riderRows.length === 0) {
      return res.status(404).json({ error: 'Assigned rider not found' });
    }
    const rider = riderRows[0];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f3f4f6; padding: 20px; color: #1f2937; margin: 0; }
          .container { max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          .rider-card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .rider-card p { margin: 8px 0; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size:24px;">Delivery Request Accepted</h1>
            <p style="margin:5px 0 0 0; font-size:14px; opacity:0.9;">ATR Reference: ${atr.atr_number}</p>
          </div>
          <div class="content">
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px; line-height: 1.5;">Good news! Your delivery request (<strong>${atr.atr_number}</strong>) has been accepted and a rider has been successfully assigned to it.</p>
            
            <div class="rider-card">
              <h3 style="margin-top: 0; color: #374151; font-size: 18px;">Assigned Rider Details:</h3>
              <p><strong>Name:</strong> ${rider.staff_name}</p>
              <p><strong>Phone:</strong> ${rider.staff_phone}</p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563;">Your rider will contact you soon or you can reach out to them directly. Thank you for choosing SC Courier Services!</p>
          </div>
          <div class="footer">
            <p>This is an automated message from SC Courier Services.</p>
            <p>&copy; 2026 SC Courier Services. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"SC Courier Services" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Delivery Accepted & Rider Assigned - ${atr.atr_number}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Assignment email sent to ${customerEmail} (ATR: ${atr.atr_number})`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Email Preview URL: ${previewUrl}`);
    }

    res.json({ message: 'Assignment email sent successfully', previewUrl });
  } catch (err) {
    console.error('Error sending assignment email:', err);
    res.status(500).json({ error: 'Server error while sending assignment email' });
  }
});

// ============================================================
// DELIVERY ACCEPTANCE, SCHEDULING & RIDER AUTO-ASSIGNMENT
// ============================================================

// Helper: Supabase REST headers
const getSupabaseHeaders = () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  return {
    url: SUPABASE_URL,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  };
};

// Helper: Generate a random token
const generateToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

// Helper: Geocode an address using OpenStreetMap Nominatim (free, no API key)
const geocodeAddress = async (address) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SCCourierServices/1.0' }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
};

// Helper: Calculate distance between two lat/lng points (Haversine formula, in km)
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// -------------------------------------------------------
// 1. POST /api/delivery/accept — Staff/Admin accepts a personal delivery
// -------------------------------------------------------
app.post('/api/delivery/accept', async (req, res) => {
  const { pdId, acceptedBy } = req.body;
  if (!pdId || !acceptedBy) {
    return res.status(400).json({ error: 'pdId and acceptedBy are required' });
  }

  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();

  try {
    // Fetch the personal delivery
    const pdRes = await fetch(
      `${sbUrl}/rest/v1/personal_delivery?pd_id=eq.${pdId}&select=*`,
      { headers: sbHeaders }
    );
    const pdRows = await pdRes.json();
    if (!pdRows || pdRows.length === 0) {
      return res.status(404).json({ error: 'Personal delivery not found' });
    }
    const pd = pdRows[0];

    if (pd.status !== 'Pending') {
      return res.status(400).json({ error: `Delivery is already ${pd.status}` });
    }

    // Generate a unique scheduling token
    const scheduleToken = generateToken();

    // Geocode pickup and drop addresses (for later rider assignment)
    let pickupCoords = null;
    let dropCoords = null;
    if (pd.pickup_address) {
      pickupCoords = await geocodeAddress(pd.pickup_address);
    }
    if (pd.drop_address) {
      dropCoords = await geocodeAddress(pd.drop_address);
    }

    // Update the delivery status to Accepted
    const updateBody = {
      status: 'Accepted',
      accepted_by: acceptedBy,
      accepted_at: new Date().toISOString(),
      schedule_token: scheduleToken
    };
    // Also store geocoded coordinates if we got them
    if (pickupCoords) {
      updateBody.pickup_lat = pickupCoords.lat;
      updateBody.pickup_lng = pickupCoords.lng;
    }
    if (dropCoords) {
      updateBody.drop_lat = dropCoords.lat;
      updateBody.drop_lng = dropCoords.lng;
    }

    await fetch(
      `${sbUrl}/rest/v1/personal_delivery?pd_id=eq.${pdId}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(updateBody)
      }
    );

    // Construct scheduling link
    const scheduleUrl = `http://localhost:${port}/api/delivery/schedule/${scheduleToken}`;

    // Send acceptance email with scheduling link to the customer
    const formattedDate = pd.requested_date ? new Date(pd.requested_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f3f4f6; padding: 20px; color: #1f2937; margin: 0; }
          .container { max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #7c3aed, #a855f7, #c084fc); color: #ffffff; padding: 35px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 35px 30px; }
          .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #1f2937; }
          .details-card { background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .details-card h3 { margin: 0 0 14px 0; font-size: 15px; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #64748b; font-weight: 500; }
          .detail-value { color: #1e293b; font-weight: 600; text-align: right; max-width: 60%; }
          .cta-section { text-align: center; margin: 32px 0 20px 0; }
          .cta-section p { font-size: 15px; color: #475569; margin-bottom: 20px; line-height: 1.6; }
          .cta-btn { display: inline-block; background: linear-gradient(135deg, #7c3aed, #9333ea); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); }
          .footer { background-color: #f8fafc; padding: 20px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          .emoji { font-size: 20px; margin-right: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Delivery Accepted!</h1>
            <p>Your personal delivery request has been approved</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${pd.sender_name},</div>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Great news! Your personal delivery request has been <strong style="color: #7c3aed;">accepted</strong> and is ready to be scheduled.
              Please choose your preferred delivery date and time using the button below.
            </p>

            <div class="details-card">
              <h3>📋 Delivery Details</h3>
              <div class="detail-row">
                <span class="detail-label">Pickup</span>
                <span class="detail-value">${pd.pickup_address}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Drop-off</span>
                <span class="detail-value">${pd.drop_address}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Item Type</span>
                <span class="detail-value">${pd.item_type}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Receiver</span>
                <span class="detail-value">${pd.receiver_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Requested Date</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
            </div>

            <div class="cta-section">
              <p>
                <span class="emoji">📅</span> Pick a convenient time slot for your delivery.
                We'll assign the closest available rider to ensure fast, efficient service.
              </p>
              <a href="${scheduleUrl}" class="cta-btn">Schedule My Delivery</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message from SC Courier Services.</p>
            <p>&copy; 2026 SC Courier Services. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"SC Courier Services" <${process.env.SMTP_USER || 'no-reply@sccourier.com'}>`,
      to: pd.cust_email,
      subject: '✅ Delivery Accepted — Schedule Your Preferred Time',
      html: htmlContent,
    };

    if (!transporter) {
      await setupTransporter();
    }
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Scheduling Email Preview URL: ${previewUrl}`);
    }

    console.log(`Acceptance email sent to ${pd.cust_email} (PD: ${pd.pd_id})`);

    res.json({
      message: 'Delivery accepted and scheduling email sent!',
      scheduleUrl,
      previewUrl
    });
  } catch (err) {
    console.error('Error accepting delivery:', err);
    res.status(500).json({ error: 'Server error while accepting delivery' });
  }
});

// -------------------------------------------------------
// 2. GET /api/delivery/schedule/:token — Serve the scheduling page
// -------------------------------------------------------
app.get('/api/delivery/schedule/:token', async (req, res) => {
  const { token } = req.params;
  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();

  try {
    // Look up the delivery by schedule token
    const pdRes = await fetch(
      `${sbUrl}/rest/v1/personal_delivery?schedule_token=eq.${encodeURIComponent(token)}&select=*`,
      { headers: sbHeaders }
    );
    const pdRows = await pdRes.json();

    if (!pdRows || pdRows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><title>Link Expired</title>
        <style>body{font-family:'Inter',sans-serif;text-align:center;padding:60px;background:#f3f4f6;color:#1f2937;}
        .card{background:white;max-width:480px;margin:0 auto;padding:48px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.1);}
        h1{color:#ef4444;font-size:28px;}</style></head>
        <body><div class="card"><h1>Link Invalid or Expired</h1>
        <p>This scheduling link is no longer valid.</p></div></body></html>
      `);
    }

    const pd = pdRows[0];

    // If already scheduled, show confirmation
    if (pd.scheduled_date && pd.scheduled_time) {
      return res.send(`
        <!DOCTYPE html><html><head><title>Already Scheduled</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:'Inter',sans-serif;text-align:center;padding:60px 20px;background:#f3f4f6;color:#1f2937;}
        .card{background:white;max-width:480px;margin:0 auto;padding:48px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.1);}
        h1{color:#7c3aed;font-size:24px;} .badge{display:inline-block;background:#f3e8ff;color:#7c3aed;padding:8px 20px;border-radius:999px;font-weight:600;margin:16px 0;}</style></head>
        <body><div class="card">
        <h1>✅ Already Scheduled</h1>
        <div class="badge">${pd.scheduled_date} at ${pd.scheduled_time}</div>
        <p style="color:#64748b;margin-top:16px;">Your delivery is already scheduled. A rider will be assigned shortly.</p>
        </div></body></html>
      `);
    }

    // Serve the scheduling form
    const formattedDate = pd.requested_date || '';
    const formattedTime = pd.requested_time || '';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Schedule Your Delivery — SC Courier</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #e2e8f0;
          }
          .card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1);
            max-width: 520px;
            width: 100%;
            padding: 0;
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            overflow: hidden;
          }
          .card-header {
            background: linear-gradient(135deg, #7c3aed, #a855f7);
            padding: 32px 30px;
            text-align: center;
          }
          .card-header h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; }
          .card-header p { font-size: 14px; color: rgba(255,255,255,0.85); }
          .card-body { padding: 32px 30px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
          .info-item { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; }
          .info-item.full { grid-column: 1 / -1; }
          .info-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
          .info-value { font-size: 14px; color: #f1f5f9; font-weight: 500; word-break: break-word; }
          .form-group { margin-bottom: 20px; }
          .form-group label {
            display: block; font-size: 13px; font-weight: 600; color: #cbd5e1;
            margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;
          }
          .form-group input {
            width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
            color: #f1f5f9; font-size: 15px; outline: none; transition: all 0.3s;
            font-family: 'Inter', sans-serif;
          }
          .form-group input:focus {
            border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.2);
          }
          .submit-btn {
            width: 100%; padding: 16px; background: linear-gradient(135deg, #7c3aed, #9333ea);
            color: #fff; border: none; border-radius: 12px; font-size: 16px; font-weight: 700;
            cursor: pointer; transition: all 0.3s; letter-spacing: 0.3px;
            box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
          }
          .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5); }
          .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
          .note { text-align: center; font-size: 12px; color: #64748b; margin-top: 20px; line-height: 1.5; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .card { animation: fadeIn 0.6s ease; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-header">
            <h1>📅 Schedule Your Delivery</h1>
            <p>Choose your preferred delivery date and time</p>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Pickup</div>
                <div class="info-value">${pd.pickup_address}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Drop-off</div>
                <div class="info-value">${pd.drop_address}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Item</div>
                <div class="info-value">${pd.item_type}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Receiver</div>
                <div class="info-value">${pd.receiver_name}</div>
              </div>
            </div>

            <form id="scheduleForm" method="POST" action="/api/delivery/schedule/${token}">
              <div class="form-group">
                <label for="scheduled_date">📆 Preferred Date</label>
                <input type="date" id="scheduled_date" name="scheduled_date" value="${formattedDate}" required min="${new Date().toISOString().split('T')[0]}" />
              </div>
              <div class="form-group">
                <label for="scheduled_time">🕐 Preferred Time</label>
                <input type="time" id="scheduled_time" name="scheduled_time" value="${formattedTime}" required />
              </div>
              <button type="submit" class="submit-btn" id="submitBtn">
                Confirm Schedule
              </button>
            </form>

            <p class="note">
              After you confirm, we'll automatically assign the nearest available rider
              and send you a confirmation with their details.
            </p>
          </div>
        </div>

        <script>
          document.getElementById('scheduleForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = 'Scheduling...';

            const formData = new FormData(this);
            const data = {};
            formData.forEach((value, key) => { data[key] = value; });

            fetch(this.action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            .then(r => r.text())
            .then(html => { document.documentElement.innerHTML = html; })
            .catch(err => {
              btn.disabled = false;
              btn.textContent = 'Confirm Schedule';
              alert('Error scheduling delivery. Please try again.');
            });
          });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error serving schedule page:', err);
    res.status(500).send('<h1>Server Error</h1><p>Could not load the scheduling page.</p>');
  }
});

// -------------------------------------------------------
// 3. POST /api/delivery/schedule/:token — Save schedule + auto-assign rider
// -------------------------------------------------------
app.post('/api/delivery/schedule/:token', async (req, res) => {
  const { token } = req.params;
  const { scheduled_date, scheduled_time } = req.body;

  if (!scheduled_date || !scheduled_time) {
    return res.status(400).json({ error: 'scheduled_date and scheduled_time are required' });
  }

  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();

  try {
    // Fetch the delivery
    const pdRes = await fetch(
      `${sbUrl}/rest/v1/personal_delivery?schedule_token=eq.${encodeURIComponent(token)}&select=*`,
      { headers: sbHeaders }
    );
    const pdRows = await pdRes.json();

    if (!pdRows || pdRows.length === 0) {
      return res.status(404).send('<h1>Invalid Link</h1>');
    }

    const pd = pdRows[0];

    // Update scheduled date/time
    const updateBody = {
      scheduled_date,
      scheduled_time,
      status: 'Scheduled'
    };

    // Auto-assign the nearest available rider
    let assignedRider = null;
    try {
      // Fetch all available riders
      const ridersRes = await fetch(
        `${sbUrl}/rest/v1/rider?availability_status=eq.Available&select=*`,
        { headers: sbHeaders }
      );
      const riders = await ridersRes.json();

      if (riders && riders.length > 0) {
        // If we have pickup coordinates, find the nearest rider with coordinates
        if (pd.pickup_lat && pd.pickup_lng) {
          const ridersWithCoords = riders.filter(r => r.current_lat && r.current_lng);

          if (ridersWithCoords.length > 0) {
            // Sort by distance to pickup
            ridersWithCoords.sort((a, b) => {
              const distA = haversineDistance(pd.pickup_lat, pd.pickup_lng, a.current_lat, a.current_lng);
              const distB = haversineDistance(pd.pickup_lat, pd.pickup_lng, b.current_lat, b.current_lng);
              return distA - distB;
            });
            assignedRider = ridersWithCoords[0];
          } else {
            // No riders have coordinates, assign the first available rider
            assignedRider = riders[0];
          }
        } else {
          // No pickup coordinates, assign the first available rider
          assignedRider = riders[0];
        }

        if (assignedRider) {
          updateBody.assigned_rider_nic = assignedRider.nic;
          updateBody.status = 'Assigned';

          // Update rider availability to Busy
          await fetch(
            `${sbUrl}/rest/v1/rider?nic=eq.${encodeURIComponent(assignedRider.nic)}`,
            {
              method: 'PATCH',
              headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
              body: JSON.stringify({ availability_status: 'Busy' })
            }
          );
        }
      }
    } catch (riderErr) {
      console.error('Error during rider assignment:', riderErr);
      // Continue without rider assignment — it can be done manually
    }

    // Update the delivery
    await fetch(
      `${sbUrl}/rest/v1/personal_delivery?schedule_token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(updateBody)
      }
    );

    // Send confirmation email to customer
    const riderInfoHtml = assignedRider ? `
      <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 14px 0; font-size: 15px; color: #166534; font-weight: 600;">🏍️ Assigned Rider</h3>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
          <span style="color: #4ade80; font-weight: 500;">Name</span>
          <span style="color: #166534; font-weight: 600;">${assignedRider.name}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
          <span style="color: #4ade80; font-weight: 500;">Phone</span>
          <span style="color: #166534; font-weight: 600;">${assignedRider.phone_number}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
          <span style="color: #4ade80; font-weight: 500;">Vehicle</span>
          <span style="color: #166534; font-weight: 600;">${assignedRider.vehicle_type || 'N/A'} — ${assignedRider.vehicle_no || 'N/A'}</span>
        </div>
      </div>
    ` : `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="color: #92400e; font-size: 14px; margin: 0;">⏳ A rider will be assigned shortly. You'll receive another notification.</p>
      </div>
    `;

    const confirmHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: 'Inter', sans-serif; background: #f3f4f6; padding: 20px; margin: 0; color: #1f2937; }
        .container { max-width: 600px; background: #fff; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #059669, #10b981); color: #fff; padding: 35px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
        .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 35px 30px; }
        .schedule-badge { display: inline-block; background: linear-gradient(135deg, #f0fdf4, #dcfce7); color: #166534; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 16px 0; border: 1px solid #bbf7d0; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style></head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Delivery Scheduled!</h1>
            <p>Your delivery is confirmed and on its way</p>
          </div>
          <div class="content">
            <p style="font-size: 16px; font-weight: 600;">Hello ${pd.sender_name},</p>
            <p style="font-size: 15px; color: #475569; line-height: 1.6;">
              Your delivery has been successfully scheduled. Here are the confirmed details:
            </p>
            <div style="text-align: center;">
              <div class="schedule-badge">📅 ${scheduled_date} at 🕐 ${scheduled_time}</div>
            </div>
            ${riderInfoHtml}
            <p style="font-size: 14px; color: #64748b; text-align: center;">
              Your rider will contact you at the scheduled time. Thank you for choosing SC Courier Services!
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from SC Courier Services.</p>
            <p>&copy; 2026 SC Courier Services. All rights reserved.</p>
          </div>
        </div>
      </body></html>
    `;

    // Send confirmation email
    try {
      if (!transporter) await setupTransporter();
      const mailOptions = {
        from: `"SC Courier Services" <${process.env.SMTP_USER || 'no-reply@sccourier.com'}>`,
        to: pd.cust_email,
        subject: `📅 Delivery Scheduled — ${scheduled_date} at ${scheduled_time}`,
        html: confirmHtml,
      };
      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log(`Schedule Confirmation Email Preview: ${previewUrl}`);
    } catch (emailErr) {
      console.error('Failed to send schedule confirmation email:', emailErr);
    }

    // Send success response page
    const riderSection = assignedRider ? `
      <div class="details">
        <div class="details-row"><span class="label">Assigned Rider</span><span class="value">${assignedRider.name}</span></div>
        <div class="details-row"><span class="label">Rider Phone</span><span class="value">${assignedRider.phone_number}</span></div>
        <div class="details-row"><span class="label">Vehicle</span><span class="value">${assignedRider.vehicle_type || 'N/A'} — ${assignedRider.vehicle_no || 'N/A'}</span></div>
      </div>
    ` : `<p style="color: #f59e0b; text-align: center; font-weight: 500; margin: 20px 0;">⏳ A rider will be assigned shortly.</p>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Delivery Scheduled — SC Courier</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;
          }
          .card {
            background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1); max-width: 500px; width: 100%;
            padding: 48px 36px; border-radius: 24px; text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: fadeIn 0.6s ease;
          }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #f1f5f9; font-size: 26px; font-weight: 700; margin-bottom: 8px; }
          .badge {
            display: inline-block; background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.15));
            color: #34d399; padding: 10px 24px; border-radius: 999px; font-weight: 600; font-size: 15px;
            margin: 16px 0 24px 0; border: 1px solid rgba(52,211,153,0.3);
          }
          .details {
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px;
          }
          .details-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .details-row:last-child { border-bottom: none; }
          .label { color: #94a3b8; font-size: 13px; font-weight: 500; }
          .value { color: #f1f5f9; font-size: 13px; font-weight: 600; }
          .note { color: #64748b; font-size: 12px; margin-top: 8px; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>Delivery Scheduled!</h1>
          <div class="badge">📅 ${scheduled_date} at 🕐 ${scheduled_time}</div>
          
          <div class="details">
            <div class="details-row"><span class="label">Pickup</span><span class="value">${pd.pickup_address}</span></div>
            <div class="details-row"><span class="label">Drop-off</span><span class="value">${pd.drop_address}</span></div>
            <div class="details-row"><span class="label">Item</span><span class="value">${pd.item_type}</span></div>
            <div class="details-row"><span class="label">Receiver</span><span class="value">${pd.receiver_name}</span></div>
          </div>

          ${riderSection}

          <p class="note">A confirmation email has been sent to ${pd.cust_email}. You can now close this tab.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error scheduling delivery:', err);
    res.status(500).send('<h1>Server Error</h1><p>Could not schedule the delivery.</p>');
  }
});

// -------------------------------------------------------
// 4. GET /api/delivery/:id/map — Route map page for rider
// -------------------------------------------------------
app.get('/api/delivery/:id/map', async (req, res) => {
  const { id } = req.params;
  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();

  try {
    const pdRes = await fetch(
      `${sbUrl}/rest/v1/personal_delivery?pd_id=eq.${id}&select=*`,
      { headers: sbHeaders }
    );
    const pdRows = await pdRes.json();

    if (!pdRows || pdRows.length === 0) {
      return res.status(404).send('<h1>Delivery Not Found</h1>');
    }

    const pd = pdRows[0];

    // If we don't have coordinates, try geocoding now
    let pickupLat = pd.pickup_lat;
    let pickupLng = pd.pickup_lng;
    let dropLat = pd.drop_lat;
    let dropLng = pd.drop_lng;

    if (!pickupLat || !pickupLng) {
      const coords = await geocodeAddress(pd.pickup_address);
      if (coords) { pickupLat = coords.lat; pickupLng = coords.lng; }
    }
    if (!dropLat || !dropLng) {
      const coords = await geocodeAddress(pd.drop_address);
      if (coords) { dropLat = coords.lat; dropLng = coords.lng; }
    }

    // Default to Colombo, Sri Lanka if geocoding fails
    if (!pickupLat) pickupLat = 6.9271;
    if (!pickupLng) pickupLng = 79.8612;
    if (!dropLat) dropLat = 6.9271;
    if (!dropLng) dropLng = 79.8612;

    // Center point for the map
    const centerLat = (pickupLat + dropLat) / 2;
    const centerLng = (pickupLng + dropLng) / 2;

    // Fetch assigned rider info
    let riderInfo = '';
    if (pd.assigned_rider_nic) {
      const riderRes = await fetch(
        `${sbUrl}/rest/v1/rider?nic=eq.${encodeURIComponent(pd.assigned_rider_nic)}&select=*`,
        { headers: sbHeaders }
      );
      const riderRows = await riderRes.json();
      if (riderRows && riderRows.length > 0) {
        const rider = riderRows[0];
        riderInfo = `
          <div class="rider-card">
            <h3>🏍️ Rider</h3>
            <p><strong>${rider.name}</strong></p>
            <p>${rider.phone_number}</p>
            <p>${rider.vehicle_type || ''} ${rider.vehicle_no || ''}</p>
          </div>
        `;
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Delivery Route — SC Courier</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 100vh;
          }
          .top-bar {
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            padding: 16px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          }
          .top-bar h1 { font-size: 18px; font-weight: 700; color: #f1f5f9; }
          .top-bar .status-badge {
            background: ${pd.status === 'Assigned' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)'};
            color: ${pd.status === 'Assigned' ? '#34d399' : '#fbbf24'};
            padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
            border: 1px solid ${pd.status === 'Assigned' ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'};
          }
          #map { width: 100%; height: 60vh; margin-top: 60px; }
          .info-panel {
            padding: 20px 24px;
          }
          .route-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
          }
          .loc-card {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 16px;
          }
          .loc-card.pickup { border-left: 3px solid #3b82f6; }
          .loc-card.drop { border-left: 3px solid #ef4444; }
          .loc-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
          .loc-card .addr { font-size: 14px; color: #f1f5f9; font-weight: 500; }
          .delivery-info {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px; margin-bottom: 16px;
          }
          .delivery-info .item {
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px; padding: 12px; text-align: center;
          }
          .delivery-info .item .label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .delivery-info .item .val { font-size: 14px; font-weight: 600; color: #f1f5f9; }
          .rider-card {
            background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.05));
            border: 1px solid rgba(52,211,153,0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px;
          }
          .rider-card h3 { font-size: 14px; color: #34d399; margin-bottom: 8px; }
          .rider-card p { font-size: 13px; color: #cbd5e1; margin: 4px 0; }
          .nav-btn {
            display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff; text-decoration: none; text-align: center; border-radius: 12px;
            font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px rgba(59,130,246,0.3);
            margin-top: 8px;
          }
          .nav-btn:hover { opacity: 0.9; }
          @media (max-width: 600px) {
            .route-info { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <h1>📍 Delivery #${pd.pd_id}</h1>
          <span class="status-badge">${pd.status}</span>
        </div>

        <div id="map"></div>

        <div class="info-panel">
          <div class="route-info">
            <div class="loc-card pickup">
              <div class="label">📍 Pickup</div>
              <div class="addr">${pd.pickup_address}</div>
            </div>
            <div class="loc-card drop">
              <div class="label">📍 Drop-off</div>
              <div class="addr">${pd.drop_address}</div>
            </div>
          </div>

          <div class="delivery-info">
            <div class="item">
              <div class="label">Item</div>
              <div class="val">${pd.item_type}</div>
            </div>
            <div class="item">
              <div class="label">Receiver</div>
              <div class="val">${pd.receiver_name}</div>
            </div>
            <div class="item">
              <div class="label">Phone</div>
              <div class="val">${pd.receiver_phone}</div>
            </div>
            <div class="item">
              <div class="label">Date</div>
              <div class="val">${pd.scheduled_date || pd.requested_date || 'TBD'}</div>
            </div>
            <div class="item">
              <div class="label">Time</div>
              <div class="val">${pd.scheduled_time || pd.requested_time || 'TBD'}</div>
            </div>
          </div>

          ${riderInfo}

          <a href="https://www.google.com/maps/dir/?api=1&origin=${pickupLat},${pickupLng}&destination=${dropLat},${dropLng}&travelmode=driving" target="_blank" class="nav-btn">
            🗺️ Open in Google Maps for Navigation
          </a>
        </div>

        <script>
          var map = L.map('map').setView([${centerLat}, ${centerLng}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Custom icons
          var pickupIcon = L.divIcon({
            html: '<div style="background:#3b82f6;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;box-shadow:0 2px 8px rgba(59,130,246,0.5);border:2px solid #fff;">P</div>',
            className: '', iconSize: [32, 32], iconAnchor: [16, 16]
          });
          var dropIcon = L.divIcon({
            html: '<div style="background:#ef4444;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;box-shadow:0 2px 8px rgba(239,68,68,0.5);border:2px solid #fff;">D</div>',
            className: '', iconSize: [32, 32], iconAnchor: [16, 16]
          });

          var pickup = L.marker([${pickupLat}, ${pickupLng}], {icon: pickupIcon}).addTo(map)
            .bindPopup('<strong>Pickup</strong><br>${pd.pickup_address.replace(/'/g, "\\'")}');
          var drop = L.marker([${dropLat}, ${dropLng}], {icon: dropIcon}).addTo(map)
            .bindPopup('<strong>Drop-off</strong><br>${pd.drop_address.replace(/'/g, "\\'")}');

          // Draw route line
          var routeLine = L.polyline([
            [${pickupLat}, ${pickupLng}],
            [${dropLat}, ${dropLng}]
          ], { color: '#7c3aed', weight: 4, opacity: 0.8, dashArray: '10, 10' }).addTo(map);

          // Fit map to show both markers
          var bounds = L.latLngBounds([
            [${pickupLat}, ${pickupLng}],
            [${dropLat}, ${dropLng}]
          ]);
          map.fitBounds(bounds, { padding: [50, 50] });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error serving map page:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

// -------------------------------------------------------
// 5. GET /api/riders — List all riders (for admin/staff dashboards)
// -------------------------------------------------------
app.get('/api/riders', async (req, res) => {
  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();
  try {
    const ridersRes = await fetch(
      `${sbUrl}/rest/v1/rider?select=*&order=name`,
      { headers: sbHeaders }
    );
    const riders = await ridersRes.json();
    res.json(riders || []);
  } catch (err) {
    console.error('Error fetching riders:', err);
    res.status(500).json({ error: 'Server error fetching riders' });
  }
});

// In-memory fallback array for personal deliveries if Supabase table is not yet created
let fallbackDeliveries = [];
let fallbackIdCounter = 1;

// -------------------------------------------------------
// 6. GET /api/personal-deliveries — Fetch all personal deliveries
// -------------------------------------------------------
app.get('/api/personal-deliveries', async (req, res) => {
  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();
  try {
    const pdRes = await fetch(
      `${sbUrl}/rest/v1/personal_delivery?select=*&order=pd_id.desc`,
      { headers: sbHeaders }
    );
    const deliveries = await pdRes.json();
    if (Array.isArray(deliveries) && deliveries.length > 0) {
      return res.json(deliveries);
    }
    // Return combined or fallback deliveries
    res.json(fallbackDeliveries.length > 0 ? fallbackDeliveries : (Array.isArray(deliveries) ? deliveries : []));
  } catch (err) {
    console.error('Error fetching personal deliveries from Supabase:', err);
    res.json(fallbackDeliveries);
  }
});

// -------------------------------------------------------
// 7. POST /api/personal-delivery/create — Submit a new personal delivery
// -------------------------------------------------------
app.post('/api/personal-delivery/create', async (req, res) => {
  const insertData = req.body;
  const { url: sbUrl, headers: sbHeaders } = getSupabaseHeaders();

  try {
    const sbRes = await fetch(`${sbUrl}/rest/v1/personal_delivery`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify(insertData)
    });

    if (sbRes.ok) {
      const inserted = await sbRes.json();
      return res.json({ success: true, data: inserted });
    } else {
      const errJson = await sbRes.json();
      console.warn('Supabase insert warning/error:', errJson);
      // Fallback to local memory storage so the app works seamless
      const newDelivery = {
        pd_id: fallbackIdCounter++,
        ...insertData,
        created_at: new Date().toISOString()
      };
      fallbackDeliveries.unshift(newDelivery);
      return res.json({ success: true, data: [newDelivery], note: 'Stored in local backend fallback' });
    }
  } catch (err) {
    console.error('Backend submission error:', err);
    const newDelivery = {
      pd_id: fallbackIdCounter++,
      ...insertData,
      created_at: new Date().toISOString()
    };
    fallbackDeliveries.unshift(newDelivery);
    res.json({ success: true, data: [newDelivery], note: 'Stored in local backend fallback' });
  }
});

