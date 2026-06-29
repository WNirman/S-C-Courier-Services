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
