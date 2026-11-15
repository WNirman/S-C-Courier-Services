const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { generateInvoicePdfBuffer, formatLkr } = require('./pdfInvoiceGenerator');

const STORE_FILE = path.join(__dirname, 'invoices_store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
        corporateConfigs: parsed.corporateConfigs && typeof parsed.corporateConfigs === 'object' ? parsed.corporateConfigs : {},
        invoicedRequestKeys: parsed.invoicedRequestKeys && typeof parsed.invoicedRequestKeys === 'object' ? parsed.invoicedRequestKeys : {},
        lastSchedulerRun: parsed.lastSchedulerRun || null
      };
    }
  } catch (err) {
    console.warn('Error reading invoices_store.json:', err.message);
  }
  return {
    invoices: [],
    corporateConfigs: {},
    invoicedRequestKeys: {},
    lastSchedulerRun: null
  };
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving invoices_store.json:', err.message);
  }
}

/**
 * Leap-year aware helper returning last day of month (1-indexed month: 1=Jan, 2=Feb, ..., 12=Dec)
 */
function getLastDayOfMonth(year, month1Indexed) {
  return new Date(year, month1Indexed, 0).getDate();
}

/**
 * Computes billing period start and end dates for a given frequency and reference YYYY-MM / period
 */
function computeBillingPeriod(frequency, yearMonthStr, halfPeriod = 'auto') {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (yearMonthStr && /^\d{4}-\d{2}$/.test(yearMonthStr)) {
    const parts = yearMonthStr.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  }

  const mm = String(month).padStart(2, '0');
  const lastDay = getLastDayOfMonth(year, month);

  if (frequency === 'Every 15 Days') {
    let useFirstHalf = halfPeriod === 'first';
    if (halfPeriod === 'auto') {
      useFirstHalf = now.getDate() <= 15;
    }
    if (useFirstHalf) {
      return {
        startDate: `${year}-${mm}-01`,
        endDate: `${year}-${mm}-15`,
        label: `${year}-${mm}-01 to ${year}-${mm}-15`
      };
    } else {
      return {
        startDate: `${year}-${mm}-16`,
        endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
        label: `${year}-${mm}-16 to ${year}-${mm}-${String(lastDay).padStart(2, '0')}`
      };
    }
  }

  if (frequency === 'Monthly') {
    return {
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      label: `${year}-${mm}-01 to ${year}-${mm}-${String(lastDay).padStart(2, '0')}`
    };
  }

  const todayIso = now.toISOString().split('T')[0];
  return {
    startDate: todayIso,
    endDate: todayIso,
    label: todayIso
  };
}

/**
 * Ensures PostgreSQL tables exist for invoices and corporate billing configuration
 */
async function ensureInvoiceTables(pool) {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS corporate_billing_config (
        cust_email VARCHAR(255) PRIMARY KEY,
        company_name VARCHAR(255),
        billing_email VARCHAR(255),
        billing_address TEXT,
        customer_phone VARCHAR(60),
        invoice_frequency VARCHAR(60) DEFAULT 'Monthly',
        preferred_invoice_day INT DEFAULT 1,
        payment_terms VARCHAR(60) DEFAULT 'Net 15 Days',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        invoice_id VARCHAR(80) PRIMARY KEY,
        invoice_number VARCHAR(80) UNIQUE NOT NULL,
        customer_type VARCHAR(30) NOT NULL,
        customer_email VARCHAR(255),
        billing_email VARCHAR(255),
        customer_name VARCHAR(255),
        company_name VARCHAR(255),
        billing_address TEXT,
        customer_phone VARCHAR(60),
        invoice_frequency VARCHAR(60),
        billing_period_start VARCHAR(30),
        billing_period_end VARCHAR(30),
        billing_period_label VARCHAR(120),
        issue_date VARCHAR(30),
        total_shipments INT DEFAULT 1,
        subtotal NUMERIC(12,2) DEFAULT 0,
        tax_amount NUMERIC(12,2) DEFAULT 0,
        additional_charges NUMERIC(12,2) DEFAULT 0,
        total_payable NUMERIC(12,2) DEFAULT 0,
        amount_paid NUMERIC(12,2) DEFAULT 0,
        payment_terms VARCHAR(60),
        payment_status VARCHAR(40) DEFAULT 'Unpaid',
        email_status VARCHAR(40) DEFAULT 'Pending',
        email_sent_at TIMESTAMPTZ,
        email_error TEXT,
        line_items JSONB DEFAULT '[]'::jsonb,
        audit_log JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.warn('Invoice table initialization note (using store fallback):', err.message);
  }
}

/**
 * Syncs an invoice record to PostgreSQL if available
 */
async function syncInvoiceToDb(pool, invoice) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO invoices (
        invoice_id, invoice_number, customer_type, customer_email, billing_email,
        customer_name, company_name, billing_address, customer_phone, invoice_frequency,
        billing_period_start, billing_period_end, billing_period_label, issue_date,
        total_shipments, subtotal, tax_amount, additional_charges, total_payable,
        amount_paid, payment_terms, payment_status, email_status, email_sent_at,
        email_error, line_items, audit_log
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      )
      ON CONFLICT (invoice_id) DO UPDATE SET
        payment_status = EXCLUDED.payment_status,
        amount_paid = EXCLUDED.amount_paid,
        email_status = EXCLUDED.email_status,
        email_sent_at = EXCLUDED.email_sent_at,
        email_error = EXCLUDED.email_error,
        line_items = EXCLUDED.line_items,
        audit_log = EXCLUDED.audit_log;`,
      [
        invoice.invoice_id,
        invoice.invoice_number,
        invoice.customer_type,
        invoice.customer_email,
        invoice.billing_email,
        invoice.customer_name,
        invoice.company_name,
        invoice.billing_address,
        invoice.customer_phone,
        invoice.invoice_frequency,
        invoice.billing_period_start,
        invoice.billing_period_end,
        invoice.billing_period_label,
        invoice.issue_date,
        invoice.total_shipments,
        invoice.subtotal,
        invoice.tax_amount || 0,
        invoice.additional_charges || 0,
        invoice.total_payable,
        invoice.amount_paid || 0,
        invoice.payment_terms,
        invoice.payment_status,
        invoice.email_status,
        invoice.email_sent_at || null,
        invoice.email_error || null,
        JSON.stringify(invoice.line_items || []),
        JSON.stringify(invoice.audit_log || [])
      ]
    );
  } catch (err) {
    console.warn('DB sync note for invoice:', err.message);
  }
}

/**
 * Helper to extract the Corporate Customer's real Company Name, Officer Name, and Department
 * without ever falling back to the courier provider's own name ("SC Courier Services").
 */
function resolveCorporateIdentity({ custName = '', configCompanyName = '', deptCompName = '', deptName = '' }) {
  const isProviderName = (n) => {
    const s = String(n || '').trim().toLowerCase();
    return !s || s === 'sc courier services' || s === 'sc courier' || s === 's c courier service' || s === 'corporate partner' || s === 'corporate client';
  };

  let parsedOfficer = String(custName || '').trim();
  let parsedCompany = '';

  // Check if cust_name is formatted as "Officer Name (Company Name)", e.g. "Vigneswaran (Hayles Fabric)"
  const parenMatch = parsedOfficer.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    parsedOfficer = parenMatch[1].trim();
    parsedCompany = parenMatch[2].trim();
  }

  let finalCompany = '';
  if (!isProviderName(configCompanyName)) {
    finalCompany = configCompanyName.trim();
  } else if (!isProviderName(parsedCompany)) {
    finalCompany = parsedCompany;
  } else if (!isProviderName(deptCompName)) {
    finalCompany = deptCompName.trim();
  } else {
    finalCompany = parsedCompany || parsedOfficer || 'Corporate Client';
  }

  let finalDept = String(deptName || 'Operations').trim();
  if (finalDept && !/department|dept/i.test(finalDept)) {
    finalDept = `${finalDept} Department`;
  }

  return {
    companyName: finalCompany,
    officerName: parsedOfficer || finalCompany,
    departmentName: finalDept || 'Operations Department'
  };
}

/**
 * Get or default Corporate Customer Billing Config
 */
function getCorporateBillingConfig(custEmail, fallbackInfo = {}) {
  const store = loadStore();
  const key = String(custEmail || '').trim().toLowerCase();
  const existing = store.corporateConfigs[key] || {};
  const identity = resolveCorporateIdentity({
    custName: fallbackInfo.cust_name || fallbackInfo.customer_name || existing.customer_name || '',
    configCompanyName: existing.company_name || fallbackInfo.company_name || '',
    deptCompName: fallbackInfo.dept_comp_name || '',
    deptName: existing.department_name || fallbackInfo.department_name || 'Operations'
  });

  return {
    cust_email: custEmail || existing.cust_email || '',
    company_name: identity.companyName,
    department_name: identity.departmentName,
    customer_name: identity.officerName,
    billing_email: existing.billing_email || fallbackInfo.billing_email || custEmail || '',
    billing_address: existing.billing_address || fallbackInfo.billing_address || fallbackInfo.cust_address || 'Sri Lanka',
    customer_phone: existing.customer_phone || fallbackInfo.customer_phone || fallbackInfo.cust_phoneno || 'N/A',
    invoice_frequency: existing.invoice_frequency || fallbackInfo.invoice_frequency || 'Monthly',
    preferred_invoice_day: existing.preferred_invoice_day || fallbackInfo.preferred_invoice_day || 1,
    payment_terms: existing.payment_terms || fallbackInfo.payment_terms || 'Net 15 Days',
    updated_at: existing.updated_at || null
  };
}

/**
 * Save Corporate Customer Billing Config
 */
async function saveCorporateBillingConfig(pool, configData) {
  const store = loadStore();
  const emailKey = String(configData.cust_email || '').trim().toLowerCase();
  if (!emailKey) throw new Error('Customer email is required');

  const existing = store.corporateConfigs[emailKey] || {};
  const validFrequencies = ['Every 15 Days', 'Monthly', 'Per Service'];
  const freq = validFrequencies.includes(configData.invoice_frequency)
    ? configData.invoice_frequency
    : (existing.invoice_frequency || 'Monthly');

  const updated = {
    cust_email: configData.cust_email.trim(),
    company_name: configData.company_name || existing.company_name || 'Corporate Client',
    billing_email: (configData.billing_email || configData.cust_email || '').trim(),
    billing_address: configData.billing_address || existing.billing_address || 'Sri Lanka',
    customer_phone: configData.customer_phone || existing.customer_phone || 'N/A',
    invoice_frequency: freq,
    preferred_invoice_day: Number(configData.preferred_invoice_day) || existing.preferred_invoice_day || 1,
    payment_terms: configData.payment_terms || existing.payment_terms || 'Net 15 Days',
    updated_at: new Date().toISOString()
  };

  store.corporateConfigs[emailKey] = updated;
  saveStore(store);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO corporate_billing_config (
          cust_email, company_name, billing_email, billing_address,
          customer_phone, invoice_frequency, preferred_invoice_day, payment_terms, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (cust_email) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          billing_email = EXCLUDED.billing_email,
          billing_address = EXCLUDED.billing_address,
          customer_phone = EXCLUDED.customer_phone,
          invoice_frequency = EXCLUDED.invoice_frequency,
          preferred_invoice_day = EXCLUDED.preferred_invoice_day,
          payment_terms = EXCLUDED.payment_terms,
          updated_at = NOW();`,
        [
          updated.cust_email,
          updated.company_name,
          updated.billing_email,
          updated.billing_address,
          updated.customer_phone,
          updated.invoice_frequency,
          updated.preferred_invoice_day,
          updated.payment_terms
        ]
      );
    } catch (e) {
      console.warn('Corporate billing config DB note:', e.message);
    }
  }

  return updated;
}

/**
 * Generates and sends the Corporate Request Acceptance Email (Section 1).
 * Does NOT generate a payment invoice unless the corporate customer's frequency is 'Per Service'.
 */
async function sendCorporateAcceptanceEmail({
  transporter,
  atr,
  customerName,
  companyName,
  customerEmail,
  billingConfig,
  approvedBy,
  ratePerKm,
  distanceKm,
  estimatedCharge
}) {
  const refNo = atr.atr_number || `ATR-${atr.atr_id}`;
  const freq = billingConfig?.invoice_frequency || 'Monthly';
  const isPerService = freq === 'Per Service';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f3f4f6; padding: 24px; color: #1f2937; margin: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; color: #ffffff; padding: 26px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">S C COURIER SERVICE</h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Corporate Courier &amp; Transport Request Acceptance</p>
                </td>
                <td align="right">
                  <span style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700;">
                    REQUEST ACCEPTED
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px;">
            <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 10px 0;">Dear ${companyName || customerName},</p>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 22px 0;">
              We are pleased to confirm that your corporate courier / transport request (<strong>${refNo}</strong>) has been <strong>accepted</strong> by our operations team.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 22px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <tr bgcolor="#f1f5f9">
                <td colspan="2" style="padding: 10px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #334155;">
                  Accepted Request Summary
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 38%;">Request ID / Reference</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 700;">${refNo}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Company / Customer</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">${companyName} (${customerName})</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Passenger / Parcel Details</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">
                  ${atr.principal_passenger_name || 'Corporate Dispatch'}${atr.principal_passenger_designation ? ` (${atr.principal_passenger_designation})` : ''} — Vehicle: ${atr.vehicle_type || 'Standard'}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Pickup &amp; Delivery Route</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">${atr.purpose_of_travel || 'Corporate Route'} (${distanceKm} km)</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Scheduled Date &amp; Time</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">${atr.required_date || 'N/A'} @ ${atr.required_time || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Acceptance Status</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #059669; font-weight: 700;">Approved &amp; Queued for Dispatch (by ${approvedBy || 'Admin'})</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; font-size: 13px; color: #64748b;">Billing Policy</td>
                <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
                  ${isPerService
                    ? 'Per Service / Shipment (Individual invoice issued separately)'
                    : `Consolidated Corporate Billing (${freq}) — Est. Charge LKR ${formatLkr(estimatedCharge)} queued for your next billing statement`
                  }
                </td>
              </tr>
            </table>

            <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
              A fleet rider will be assigned to your shipment/trip shortly. Thank you for choosing <strong>S C Courier Service</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
            S C Courier Service | No. 425/A, Nasewana Waththa, Mandawala Road, Radawana, Sri Lanka | Tel: 077-6719470 / 076-9772797
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: `"SC Courier Service" <${process.env.SMTP_USER || 'sccourier369@gmail.com'}>`,
    to: customerEmail,
    subject: `SC Courier Service – Courier Request Accepted (${refNo})`,
    html: htmlContent
  });

  return info;
}

/**
 * Sends a Corporate or Personal Invoice Email with the generated PDF attached (Section 6)
 */
async function sendInvoiceEmailWithPdf(transporter, pool, invoice, customScheduleUrl = null) {
  const store = loadStore();
  const idx = store.invoices.findIndex(inv => inv.invoice_id === invoice.invoice_id);

  try {
    const pdfBuffer = generateInvoicePdfBuffer(invoice);
    const recipient = invoice.billing_email || invoice.customer_email;
    if (!recipient) {
      throw new Error('No recipient billing email configured for customer');
    }

    const isCorp = invoice.customer_type === 'Corporate';
    const startDate = invoice.billing_period_start || invoice.issue_date;
    const endDate = invoice.billing_period_end || invoice.issue_date;
    const periodLabel = invoice.billing_period_label || `${startDate} to ${endDate}`;

    const subject = isCorp
      ? `SC Courier Service – Invoice #${invoice.invoice_number} – ${periodLabel}`
      : `SC Courier Service – Invoice #${invoice.invoice_number} – Request ${invoice.line_items?.[0]?.ref_number || ''}`;

    const lineItemsRowsHtml = (invoice.line_items || []).map((item, i) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">${i + 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #0f172a;">${item.ref_number || item.request_id}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">${item.shipment_date || '-'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
          ${item.pickup_details ? `${item.pickup_details} &rarr; ${item.delivery_details}` : (item.delivery_details || 'Corporate Dispatch')}
          <div style="font-size: 11px; color: #64748b;">${item.parcel_or_vehicle || ''} ${item.distance_km ? `(${item.distance_km} km)` : ''}</div>
        </td>
        <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #0f172a;">LKR ${formatLkr(item.amount_lkr)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f3f4f6; padding: 24px; color: #1f2937; margin: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 660px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td bgcolor="${isCorp ? '#0f172a' : '#ea580c'}" style="background-color: ${isCorp ? '#0f172a' : '#ea580c'}; color: #ffffff; padding: 26px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">S C COURIER SERVICE</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #e2e8f0;">No. 425/A, Nasewana Waththa, Mandawala Road, Radawana, Sri Lanka</p>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #cbd5e1;">Tel: 077-6719470 / 076-9772797</p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700;">
                      PDF INVOICE ATTACHED
                    </span>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #ffffff; font-weight: 700;">#${invoice.invoice_number}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 14px 0;">
                Dear ${invoice.company_name || invoice.customer_name || 'Valued Customer'},
              </p>
              ${isCorp ? `
                <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 12px 0;">
                  Please find attached your consolidated courier service invoice for the billing period <strong>${startDate}</strong> to <strong>${endDate}</strong>.
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 12px 0;">
                  The invoice includes the details of your courier shipments and the corresponding charges, along with the total amount payable.
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 22px 0;">
                  Please review the attached invoice and arrange payment according to the agreed payment terms (<strong>${invoice.payment_terms || 'Net 15 Days'}</strong>).
                </p>
              ` : `
                <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;">
                  Your courier delivery request has been accepted! Please find your official invoice details below and the official <strong>PDF Invoice (#${invoice.invoice_number})</strong> attached to this email.
                </p>
              `}

              <!-- Summary Metadata -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
                <tr>
                  <td width="50%" valign="top" style="padding: 14px; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Billed To</div>
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${invoice.company_name || invoice.customer_name}</div>
                    ${isCorp ? `<div style="font-size: 13px; font-weight: 700; color: #2563eb; margin-top: 3px;">${invoice.department_name || 'Operations Department'}</div>` : ''}
                    ${isCorp && invoice.customer_name ? `<div style="font-size: 12px; color: #334155; margin-top: 2px;">Attn: ${invoice.customer_name}</div>` : ''}
                    <div style="font-size: 12px; color: #475569; margin-top: 2px;">Address: ${invoice.billing_address || 'Sri Lanka'}</div>
                    <div style="font-size: 12px; color: #475569; margin-top: 2px;">Email: ${recipient} | Tel: ${invoice.customer_phone || 'N/A'}</div>
                  </td>
                  <td width="50%" valign="top" style="padding: 14px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Invoice Summary</div>
                    <div style="font-size: 12px; color: #334155;"><strong>Invoice No:</strong> ${invoice.invoice_number}</div>
                    <div style="font-size: 12px; color: #334155; margin-top: 2px;"><strong>Issue Date:</strong> ${invoice.issue_date}</div>
                    <div style="font-size: 12px; color: #334155; margin-top: 2px;"><strong>Billing Period:</strong> ${periodLabel}</div>
                    <div style="font-size: 12px; color: #334155; margin-top: 2px;"><strong>Payment Status:</strong> ${invoice.payment_status} (${invoice.payment_terms})</div>
                  </td>
                </tr>
              </table>

              <!-- Line Items Table -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                <tr bgcolor="#0f172a" style="background-color: #0f172a; color: #ffffff;">
                  <th align="left" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase;">#</th>
                  <th align="left" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase;">Ref No</th>
                  <th align="left" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase;">Date</th>
                  <th align="left" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase;">Shipment / Route Details</th>
                  <th align="right" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase;">Charge (LKR)</th>
                </tr>
                ${lineItemsRowsHtml}
                <tr bgcolor="#f8fafc">
                  <td colspan="4" align="right" style="padding: 10px 12px; font-size: 13px; color: #475569;">Total Shipments: <strong>${invoice.total_shipments}</strong> &nbsp;|&nbsp; Subtotal:</td>
                  <td align="right" style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: #0f172a;">LKR ${formatLkr(invoice.subtotal)}</td>
                </tr>
                <tr bgcolor="#f1f5f9">
                  <td colspan="4" align="right" style="padding: 12px; font-size: 15px; font-weight: 700; color: #0f172a;">Final Total Payable:</td>
                  <td align="right" style="padding: 12px; font-size: 16px; font-weight: 700; color: #ea580c;">LKR ${formatLkr(invoice.total_payable)}</td>
                </tr>
              </table>

              ${customScheduleUrl ? `
                <div style="text-align: center; margin: 18px 0;">
                  <a href="${customScheduleUrl}" target="_blank" style="display: inline-block; padding: 12px 26px; font-size: 14px; font-weight: bold; color: #ffffff !important; text-decoration: none; border-radius: 8px; background-color: #7c3aed;">
                    Confirm / Schedule Delivery Slot
                  </a>
                </div>
              ` : ''}

              <p style="font-size: 14px; color: #374151; margin: 18px 0 6px 0;">Thank you for choosing SC Courier Service.</p>
              <p style="font-size: 14px; color: #111827; font-weight: 600; margin: 0;">Best regards,<br/>SC Courier Service</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              S C Courier Service | No. 425/A, Nasewana Waththa, Mandawala Road, Radawana, Sri Lanka | Tel: 077-6719470 / 076-9772797
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"SC Courier Service" <${process.env.SMTP_USER || 'sccourier369@gmail.com'}>`,
      to: recipient,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    invoice.email_status = 'Sent';
    invoice.email_sent_at = new Date().toISOString();
    invoice.email_error = null;
    invoice.audit_log = invoice.audit_log || [];
    invoice.audit_log.push({
      timestamp: new Date().toISOString(),
      action: 'EMAIL_SENT',
      actor: 'System Mailer',
      note: `PDF Invoice emailed to ${recipient} (${info.response || 'OK'})`
    });

    if (idx >= 0) {
      store.invoices[idx] = invoice;
    } else {
      store.invoices.unshift(invoice);
    }
    saveStore(store);
    await syncInvoiceToDb(pool, invoice);

    return { success: true, info, invoice };
  } catch (err) {
    invoice.email_status = 'Failed';
    invoice.email_error = err.message || 'SMTP delivery failed';
    invoice.audit_log = invoice.audit_log || [];
    invoice.audit_log.push({
      timestamp: new Date().toISOString(),
      action: 'EMAIL_FAILED',
      actor: 'System Mailer',
      note: `Failed to email invoice: ${invoice.email_error}`
    });

    if (idx >= 0) {
      store.invoices[idx] = invoice;
    } else {
      store.invoices.unshift(invoice);
    }
    saveStore(store);
    await syncInvoiceToDb(pool, invoice);

    return { success: false, error: invoice.email_error, invoice };
  }
}

/**
 * Generates (or returns existing) Personal Customer Invoice for a PD request (Section 2).
 * Guarantees that an invoice is generated only once per PD request.
 */
async function createOrGetPersonalInvoice({
  pool,
  transporter,
  pd,
  customerObj,
  baseFee,
  perKmRate,
  distanceKm,
  totalAmount,
  acceptedBy,
  scheduleUrl,
  overrideEmail
}) {
  const store = loadStore();
  const reqKey = `pd-${pd.pd_id}`;

  // Anti-duplication check: Has this PD request already been invoiced?
  // Reuse the same invoice (never create a duplicate invoice number), and re-send the PDF email when requested.
  const existingInvId = store.invoicedRequestKeys[reqKey];
  if (existingInvId) {
    const existingInv = store.invoices.find(i => i.invoice_id === existingInvId);
    if (existingInv) {
      if (overrideEmail && overrideEmail.trim()) {
        existingInv.billing_email = overrideEmail.trim();
      }
      const sendRes = await sendInvoiceEmailWithPdf(transporter, pool, existingInv, scheduleUrl);
      return { invoice: sendRes.invoice, alreadyExisted: true, emailResult: sendRes };
    }
  }

  const issueDate = pd.requested_date || new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();
  const seq = String(store.invoices.filter(i => i.customer_type === 'Personal').length + 1).padStart(4, '0');
  const invoiceNumber = `INV-PD-${year}-${ String(pd.pd_id).padStart(4, '0')}-${seq}`;
  const invoiceId = `inv_pd_${pd.pd_id}_${Date.now()}`;

  const recipientEmail = (overrideEmail && overrideEmail.trim()) || pd.cust_email;
  const distCharge = Math.max(0, Number(totalAmount) - Number(baseFee));

  const newInvoice = {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    customer_type: 'Personal',
    customer_email: pd.cust_email,
    billing_email: recipientEmail,
    customer_name: pd.sender_name || customerObj?.cust_name || 'Personal Customer',
    company_name: null,
    billing_address: pd.pickup_address || customerObj?.cust_address || 'Sri Lanka',
    customer_phone: pd.sender_phone || customerObj?.cust_phoneno || 'N/A',
    invoice_frequency: 'Per Request',
    billing_period_start: issueDate,
    billing_period_end: issueDate,
    billing_period_label: issueDate,
    issue_date: new Date().toISOString().split('T')[0],
    total_shipments: 1,
    subtotal: Number(totalAmount),
    tax_amount: 0,
    additional_charges: 0,
    total_payable: Number(totalAmount),
    amount_paid: 0,
    payment_terms: 'Due on Receipt',
    payment_status: 'Unpaid',
    email_status: 'Pending',
    email_sent_at: null,
    email_error: null,
    line_items: [
      {
        request_id: reqKey,
        ref_number: `PD-${pd.pd_id}`,
        source_type: 'personal',
        shipment_date: issueDate,
        pickup_details: pd.pickup_address,
        delivery_details: pd.drop_address,
        parcel_or_vehicle: `${pd.item_type || 'Parcel'} (Base ${baseFee} + ${distanceKm}km @ ${perKmRate}/km)`,
        distance_km: Number(distanceKm),
        rate_lkr: Number(perKmRate),
        base_fee_lkr: Number(baseFee),
        amount_lkr: Number(totalAmount),
        status: pd.status || 'Approved'
      }
    ],
    audit_log: [
      {
        timestamp: new Date().toISOString(),
        action: 'INVOICE_CREATED',
        actor: acceptedBy || 'Admin',
        note: `Personal delivery invoice generated for PD-${pd.pd_id}`
      }
    ],
    created_at: new Date().toISOString()
  };

  store.invoicedRequestKeys[reqKey] = invoiceId;
  store.invoices.unshift(newInvoice);
  saveStore(store);
  await syncInvoiceToDb(pool, newInvoice);

  const sendRes = await sendInvoiceEmailWithPdf(transporter, pool, newInvoice, scheduleUrl);
  return { invoice: sendRes.invoice, alreadyExisted: false, emailResult: sendRes };
}

/**
 * Generates a Consolidated or Per-Service Corporate Invoice for a Corporate Customer
 * from a list of eligible ATR requests, preventing any duplicate invoicing.
 */
async function generateCorporateInvoiceForRequests({
  pool,
  transporter,
  custEmail,
  companyName,
  departmentName,
  customerName,
  billingConfig,
  atrRows,
  deptMap = {},
  pricingRates,
  billingPeriodStart,
  billingPeriodEnd,
  billingPeriodLabel,
  triggeredBy = 'Automated Scheduler'
}) {
  const store = loadStore();

  // Filter out any ATR requests that have already been invoiced or are not billable
  const billableStatuses = ['approved', 'accepted', 'assigned', 'in transit', 'completed', 'delivered'];
  const eligibleAtrs = (atrRows || []).filter(atr => {
    const reqKey = `atr-${atr.atr_id}`;
    if (store.invoicedRequestKeys[reqKey]) return false;
    const st = String(atr.status || '').toLowerCase();
    return billableStatuses.includes(st);
  });

  if (eligibleAtrs.length === 0) {
    return { generated: false, reason: 'No uninvoiced billable corporate requests found in period.' };
  }

  // Resolve clean Corporate Company Name, Officer Name, and Department(s)
  const deptNamesSet = new Set();
  eligibleAtrs.forEach(a => {
    const dName = deptMap[a.dep_id]?.dep_name || departmentName || 'Operations';
    if (dName) deptNamesSet.add(dName.replace(/\s*department$/i, '').trim());
  });
  const combinedDeptLabel = deptNamesSet.size > 0
    ? `${Array.from(deptNamesSet).join(' & ')} Department`
    : (departmentName || billingConfig?.department_name || 'Operations Department');

  const identity = resolveCorporateIdentity({
    custName: customerName,
    configCompanyName: companyName || billingConfig?.company_name,
    deptCompName: '',
    deptName: combinedDeptLabel
  });

  const lineItems = eligibleAtrs.map(atr => {
    const vType = atr.vehicle_type || 'Car';
    const rate = Number(pricingRates?.vehicleRates?.[vType]) || 110;
    const dist = parseFloat(atr.actual_distance || atr.estimated_distance || 10);
    const amount = parseFloat(atr.actual_cost || atr.estimated_cost || (dist * rate));
    const itemDept = deptMap[atr.dep_id]?.dep_name || combinedDeptLabel.replace(/\s*Department$/i, '');
    return {
      request_id: `atr-${atr.atr_id}`,
      ref_number: atr.atr_number || `ATR-${atr.atr_id}`,
      source_type: 'atr',
      department_name: `${itemDept} Dept`,
      shipment_date: atr.required_date || (atr.created_at ? atr.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      pickup_details: `${identity.companyName} (${itemDept} Dept)`,
      delivery_details: atr.purpose_of_travel || 'Corporate Route',
      parcel_or_vehicle: `${vType} (${atr.principal_passenger_name || 'Staff'})`,
      distance_km: Number(dist.toFixed(1)),
      rate_lkr: rate,
      amount_lkr: Number(amount.toFixed(2)),
      status: atr.status || 'Approved'
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount_lkr || 0), 0);
  const year = new Date().getFullYear();
  const corpSeq = String(store.invoices.filter(i => i.customer_type === 'Corporate').length + 1).padStart(4, '0');
  const invoiceNumber = `INV-CORP-${year}-${corpSeq}`;
  const invoiceId = `inv_corp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const issueDate = new Date().toISOString().split('T')[0];

  const newInvoice = {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    customer_type: 'Corporate',
    customer_email: custEmail,
    billing_email: billingConfig?.billing_email || custEmail,
    customer_name: identity.officerName,
    company_name: identity.companyName,
    department_name: identity.departmentName,
    billing_address: billingConfig?.billing_address || 'Sri Lanka',
    customer_phone: billingConfig?.customer_phone || 'N/A',
    invoice_frequency: billingConfig?.invoice_frequency || 'Monthly',
    billing_period_start: billingPeriodStart || issueDate,
    billing_period_end: billingPeriodEnd || issueDate,
    billing_period_label: billingPeriodLabel || `${billingPeriodStart} to ${billingPeriodEnd}`,
    issue_date: issueDate,
    total_shipments: lineItems.length,
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount: 0,
    additional_charges: 0,
    total_payable: Number(subtotal.toFixed(2)),
    amount_paid: 0,
    payment_terms: billingConfig?.payment_terms || 'Net 15 Days',
    payment_status: 'Unpaid',
    email_status: 'Pending',
    email_sent_at: null,
    email_error: null,
    line_items: lineItems,
    audit_log: [
      {
        timestamp: new Date().toISOString(),
        action: 'CONSOLIDATED_INVOICE_GENERATED',
        actor: triggeredBy,
        note: `Generated corporate invoice (${lineItems.length} shipment(s)) for billing period ${billingPeriodLabel}`
      }
    ],
    created_at: new Date().toISOString()
  };

  // Mark all included ATR requests as invoiced so they are never duplicated
  for (const item of lineItems) {
    store.invoicedRequestKeys[item.request_id] = invoiceId;
  }
  store.invoices.unshift(newInvoice);
  saveStore(store);
  await syncInvoiceToDb(pool, newInvoice);

  const emailRes = await sendInvoiceEmailWithPdf(transporter, pool, newInvoice);
  return {
    generated: true,
    invoice: emailRes.invoice,
    emailSent: emailRes.success,
    emailError: emailRes.error || null
  };
}

module.exports = {
  loadStore,
  saveStore,
  getLastDayOfMonth,
  computeBillingPeriod,
  ensureInvoiceTables,
  syncInvoiceToDb,
  resolveCorporateIdentity,
  getCorporateBillingConfig,
  saveCorporateBillingConfig,
  sendCorporateAcceptanceEmail,
  sendInvoiceEmailWithPdf,
  createOrGetPersonalInvoice,
  generateCorporateInvoiceForRequests
};
