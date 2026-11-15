import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000';

const InvoiceManagementPanel = ({ atrRequests = [], personalDeliveries = [], customerCompMap = {}, deptCompMap = {}, loggedInUser }) => {
    const [invoices, setInvoices] = useState([]);
    const [corporateConfigs, setCorporateConfigs] = useState([]);
    const [invoicedRequestKeys, setInvoicedRequestKeys] = useState({});
    const [lastSchedulerRun, setLastSchedulerRun] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCustomerType, setFilterCustomerType] = useState('all');
    const [filterPaymentStatus, setFilterPaymentStatus] = useState('all');
    const [filterEmailStatus, setFilterEmailStatus] = useState('all');
    const [filterBillingPeriod, setFilterBillingPeriod] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Automated Corporate Billing Cycle Generator State
    const [selectedCorpEmail, setSelectedCorpEmail] = useState('');
    const [selectedPeriodMode, setSelectedPeriodMode] = useState('all_uninvoiced');
    const [selectedYearMonth, setSelectedYearMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [runningCycle, setRunningCycle] = useState(false);

    // Corporate Customer Billing Configuration Form State
    const [showConfigForm, setShowConfigForm] = useState(false);
    const [cfgEmail, setCfgEmail] = useState('');
    const [cfgCompanyName, setCfgCompanyName] = useState('');
    const [cfgBillingEmail, setCfgBillingEmail] = useState('');
    const [cfgBillingAddress, setCfgBillingAddress] = useState('');
    const [cfgPhone, setCfgPhone] = useState('');
    const [cfgFrequency, setCfgFrequency] = useState('Monthly');
    const [cfgPaymentTerms, setCfgPaymentTerms] = useState('Net 15 Days');
    const [savingConfig, setSavingConfig] = useState(false);

    // Invoice Detail Modal & Resend State
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [resendingId, setResendingId] = useState(null);
    const [updatingPaymentId, setUpdatingPaymentId] = useState(null);

    const loadInvoicesData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/invoices`);
            if (res.ok) {
                const data = await res.json();
                setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
                setCorporateConfigs(Array.isArray(data.corporateConfigs) ? data.corporateConfigs : []);
                setInvoicedRequestKeys(data.invoicedRequestKeys || {});
                setLastSchedulerRun(data.lastSchedulerRun || null);
            }
        } catch (err) {
            console.error('Failed to load invoices:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvoicesData();
    }, []);

    // Helper to extract Corporate Company Name & Officer Name without using "SC Courier Services"
    const parseCorporateDisplay = (rawCustName, rawCompName, rawDeptName) => {
        const isSelfProvider = (s) => {
            const v = String(s || '').trim().toLowerCase();
            return !v || v === 'sc courier services' || v === 'sc courier' || v === 's c courier service';
        };
        let officer = String(rawCustName || '').trim();
        let extractedComp = '';
        const m = officer.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (m) {
            officer = m[1].trim();
            extractedComp = m[2].trim();
        }
        const company = !isSelfProvider(rawCompName)
            ? rawCompName
            : (!isSelfProvider(extractedComp) ? extractedComp : (officer || 'Corporate Client'));
        let dept = String(rawDeptName || 'Operations').trim();
        if (dept && !/department|dept/i.test(dept)) dept = `${dept} Department`;
        return { company, officer: officer || company, dept };
    };

    // Build distinct corporate customers from ATR requests, customerCompMap, and saved configs
    const corporateCustomersList = React.useMemo(() => {
        const map = {};
        corporateConfigs.forEach(cfg => {
            if (cfg.cust_email) {
                const parsed = parseCorporateDisplay(customerCompMap[cfg.cust_email], cfg.company_name, cfg.department_name);
                map[cfg.cust_email.toLowerCase()] = {
                    email: cfg.cust_email,
                    companyName: parsed.company,
                    departmentName: parsed.dept,
                    billingEmail: cfg.billing_email || cfg.cust_email,
                    frequency: cfg.invoice_frequency || 'Monthly',
                    paymentTerms: cfg.payment_terms || 'Net 15 Days',
                    address: cfg.billing_address || 'Sri Lanka',
                    phone: cfg.customer_phone || 'N/A'
                };
            }
        });
        atrRequests.forEach(atr => {
            if (atr.cust_email) {
                const key = atr.cust_email.toLowerCase();
                const deptInfo = deptCompMap[atr.dep_id];
                const parsed = parseCorporateDisplay(
                    customerCompMap[atr.cust_email] || atr.principal_passenger_name,
                    deptInfo?.comp_name,
                    deptInfo?.dep_name
                );
                if (!map[key]) {
                    map[key] = {
                        email: atr.cust_email,
                        companyName: parsed.company,
                        departmentName: parsed.dept,
                        billingEmail: atr.cust_email,
                        frequency: 'Monthly',
                        paymentTerms: 'Net 15 Days',
                        address: deptInfo?.comp_address || 'Sri Lanka',
                        phone: 'N/A'
                    };
                }
            }
        });
        return Object.values(map);
    }, [corporateConfigs, atrRequests, customerCompMap, deptCompMap]);

    // Count uninvoiced billable ATR requests
    const uninvoicedBillableAtrs = React.useMemo(() => {
        const billable = ['approved', 'accepted', 'assigned', 'in transit', 'completed', 'delivered'];
        return atrRequests.filter(a => {
            const key = `atr-${a.atr_id}`;
            if (invoicedRequestKeys[key]) return false;
            return billable.includes(String(a.status || '').toLowerCase());
        });
    }, [atrRequests, invoicedRequestKeys]);

    // Filtered Invoices
    const filteredInvoices = React.useMemo(() => {
        return invoices.filter(inv => {
            if (filterCustomerType !== 'all' && String(inv.customer_type || '').toLowerCase() !== filterCustomerType.toLowerCase()) {
                return false;
            }
            if (filterPaymentStatus !== 'all' && String(inv.payment_status || '').toLowerCase() !== filterPaymentStatus.toLowerCase()) {
                return false;
            }
            if (filterEmailStatus !== 'all' && String(inv.email_status || '').toLowerCase() !== filterEmailStatus.toLowerCase()) {
                return false;
            }
            if (filterDate && inv.issue_date !== filterDate) {
                return false;
            }
            if (filterBillingPeriod.trim()) {
                const bp = filterBillingPeriod.trim().toLowerCase();
                if (!String(inv.billing_period_label || '').toLowerCase().includes(bp)) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const match =
                    String(inv.invoice_number || '').toLowerCase().includes(q) ||
                    String(inv.company_name || '').toLowerCase().includes(q) ||
                    String(inv.customer_name || '').toLowerCase().includes(q) ||
                    String(inv.customer_email || '').toLowerCase().includes(q) ||
                    String(inv.billing_email || '').toLowerCase().includes(q) ||
                    (inv.line_items || []).some(li => String(li.ref_number || '').toLowerCase().includes(q));
                if (!match) return false;
            }
            return true;
        });
    }, [invoices, filterCustomerType, filterPaymentStatus, filterEmailStatus, filterDate, filterBillingPeriod, searchQuery]);

    // Summary Metrics
    const metrics = React.useMemo(() => {
        const totalRevenue = invoices.reduce((sum, i) => sum + Number(i.total_payable || 0), 0);
        const paidCount = invoices.filter(i => i.payment_status === 'Paid').length;
        const unpaidCount = invoices.filter(i => i.payment_status === 'Unpaid').length;
        const partialCount = invoices.filter(i => i.payment_status === 'Partially Paid').length;
        const sentCount = invoices.filter(i => i.email_status === 'Sent').length;
        const failedCount = invoices.filter(i => i.email_status === 'Failed').length;
        return { totalRevenue, paidCount, unpaidCount, partialCount, sentCount, failedCount };
    }, [invoices]);

    const handleRunBillingCycle = async () => {
        setRunningCycle(true);
        try {
            const res = await fetch(`${API_BASE}/api/corporate-billing/run-cycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerEmail: selectedCorpEmail || null,
                    periodMode: selectedPeriodMode,
                    yearMonth: selectedYearMonth,
                    triggeredBy: loggedInUser || 'admin@sccourier.com'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to run billing cycle');

            if (data.generatedCount > 0) {
                const nums = data.generatedInvoices.map(i => `#${i.invoice_number} (${i.company_name}: LKR ${Number(i.total_payable).toLocaleString()})`).join('\n');
                alert(`Generated and emailed ${data.generatedCount} consolidated PDF corporate invoice(s)!\n\n${nums}`);
            } else {
                alert('No uninvoiced billable corporate requests found for the selected customer/period. (Make sure corporate ATR requests are Approved first, and have not already been invoiced.)');
            }
            loadInvoicesData();
        } catch (err) {
            alert('Error running corporate billing cycle: ' + err.message);
        } finally {
            setRunningCycle(false);
        }
    };

    const handleSaveCorpConfig = async (e) => {
        e.preventDefault();
        if (!cfgEmail.trim()) {
            alert('Please enter or select a corporate customer email.');
            return;
        }
        setSavingConfig(true);
        try {
            const res = await fetch(`${API_BASE}/api/corporate-billing/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cust_email: cfgEmail.trim(),
                    company_name: cfgCompanyName.trim() || 'Corporate Client',
                    billing_email: cfgBillingEmail.trim() || cfgEmail.trim(),
                    billing_address: cfgBillingAddress.trim() || 'Sri Lanka',
                    customer_phone: cfgPhone.trim() || 'N/A',
                    invoice_frequency: cfgFrequency,
                    payment_terms: cfgPaymentTerms
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save config');
            alert(`Corporate billing configuration saved for ${data.config.company_name} (${data.config.invoice_frequency})!`);
            setShowConfigForm(false);
            loadInvoicesData();
        } catch (err) {
            alert('Error saving billing configuration: ' + err.message);
        } finally {
            setSavingConfig(false);
        }
    };

    const handleResendInvoice = async (invoice) => {
        const customEmail = window.prompt(
            `Resend PDF Invoice #${invoice.invoice_number} to email address:`,
            invoice.billing_email || invoice.customer_email || ''
        );
        if (!customEmail || !customEmail.trim()) return;

        setResendingId(invoice.invoice_id);
        try {
            const res = await fetch(`${API_BASE}/api/invoices/${encodeURIComponent(invoice.invoice_id)}/resend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overrideEmail: customEmail.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to resend invoice');
            alert(`PDF Invoice #${invoice.invoice_number} successfully emailed to ${customEmail.trim()}!`);
            loadInvoicesData();
            if (selectedInvoice && selectedInvoice.invoice_id === invoice.invoice_id) {
                setSelectedInvoice(data.invoice);
            }
        } catch (err) {
            alert('Failed to resend invoice email: ' + err.message);
            loadInvoicesData();
        } finally {
            setResendingId(null);
        }
    };

    const handleUpdatePaymentStatus = async (invoice, newStatus) => {
        setUpdatingPaymentId(invoice.invoice_id);
        try {
            let amountPaid = invoice.amount_paid || 0;
            if (newStatus === 'Partially Paid') {
                const input = window.prompt(
                    `Enter partial payment amount received (Total Payable: LKR ${invoice.total_payable}):`,
                    String(Math.round(Number(invoice.total_payable || 0) / 2))
                );
                if (input === null) {
                    setUpdatingPaymentId(null);
                    return;
                }
                amountPaid = Number(input) || 0;
            } else if (newStatus === 'Paid') {
                amountPaid = Number(invoice.total_payable || 0);
            } else {
                amountPaid = 0;
            }

            const res = await fetch(`${API_BASE}/api/invoices/${encodeURIComponent(invoice.invoice_id)}/payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment_status: newStatus,
                    amount_paid: amountPaid,
                    updatedBy: loggedInUser || 'admin@sccourier.com'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update payment status');
            loadInvoicesData();
            if (selectedInvoice && selectedInvoice.invoice_id === invoice.invoice_id) {
                setSelectedInvoice(data.invoice);
            }
        } catch (err) {
            alert('Error updating payment status: ' + err.message);
        } finally {
            setUpdatingPaymentId(null);
        }
    };

    const openEditCorpConfig = (corp) => {
        setCfgEmail(corp.email || '');
        setCfgCompanyName(corp.companyName || '');
        setCfgBillingEmail(corp.billingEmail || corp.email || '');
        setCfgBillingAddress(corp.address || 'Sri Lanka');
        setCfgPhone(corp.phone || '');
        setCfgFrequency(corp.frequency || 'Monthly');
        setCfgPaymentTerms(corp.paymentTerms || 'Net 15 Days');
        setShowConfigForm(true);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease', width: '100%' }}>
            {/* 1. KPI Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
                <div className="action-card" style={{ padding: '1.35rem', border: '1px solid var(--card-border)', margin: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Invoices</div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginTop: '0.35rem' }}>{invoices.length}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {invoices.filter(i => i.customer_type === 'Corporate').length} Corporate • {invoices.filter(i => i.customer_type === 'Personal').length} Personal
                    </div>
                </div>

                <div className="action-card" style={{ padding: '1.35rem', border: '1px solid var(--card-border)', margin: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Billed Revenue</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-color)', marginTop: '0.35rem' }}>
                        LKR {metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Uninvoiced Corporate Requests: <strong style={{ color: '#f59e0b' }}>{uninvoicedBillableAtrs.length}</strong>
                    </div>
                </div>

                <div className="action-card" style={{ padding: '1.35rem', border: '1px solid var(--card-border)', margin: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Payment Tracking</div>
                    <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'baseline', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: '1.1rem' }}>✅ {metrics.paidCount} Paid</span>
                        <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.1rem' }}>⏳ {metrics.unpaidCount} Unpaid</span>
                        <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.95rem' }}>🌗 {metrics.partialCount} Partial</span>
                    </div>
                </div>

                <div className="action-card" style={{ padding: '1.35rem', border: '1px solid var(--card-border)', margin: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Email Delivery Status</div>
                    <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'baseline', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: '1.1rem' }}>📩 {metrics.sentCount} Sent</span>
                        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>⚠️ {metrics.failedCount} Failed</span>
                    </div>
                    {lastSchedulerRun && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                            Last cycle check: {new Date(lastSchedulerRun).toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Automated Corporate Invoicing & Billing Cycle Control Card */}
            <div className="action-card" style={{ padding: '1.75rem', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(30, 41, 59, 0.35)', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className='bx bx-calendar-star' style={{ color: '#3b82f6' }}></i> Automated Corporate Invoice Generation &amp; Billing Cycles
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
                            Consolidate approved corporate shipments into a single PDF invoice by billing cycle (<strong>Every 15 Days: 1st–15th / 16th–End</strong>, <strong>Monthly: 1st–End</strong>, or <strong>Per Service</strong>) and email automatically.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setCfgEmail('');
                            setCfgCompanyName('');
                            setCfgBillingEmail('');
                            setCfgBillingAddress('');
                            setCfgPhone('');
                            setCfgFrequency('Monthly');
                            setCfgPaymentTerms('Net 15 Days');
                            setShowConfigForm(!showConfigForm);
                        }}
                        className="secondary-btn"
                        style={{ width: 'auto', padding: '0.55rem 1.1rem', height: 'auto', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.35)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                    >
                        <i className='bx bx-cog'></i> {showConfigForm ? 'Close Billing Config' : 'Configure Corporate Billing Frequency'}
                    </button>
                </div>

                {/* Corporate Billing Frequency Configuration Drawer */}
                {showConfigForm && (
                    <form onSubmit={handleSaveCorpConfig} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '14px', padding: '1.35rem', marginBottom: '1.5rem' }}>
                        <h4 style={{ color: '#e9d5ff', margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className='bx bx-buildings'></i> Configure Corporate Customer Invoice Frequency &amp; Billing Profile
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Select Existing Corporate Client</label>
                                <select
                                    value={cfgEmail}
                                    onChange={(e) => {
                                        const found = corporateCustomersList.find(c => c.email === e.target.value);
                                        if (found) {
                                            openEditCorpConfig(found);
                                        } else {
                                            setCfgEmail(e.target.value);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)' }}
                                >
                                    <option value="">-- Choose or type below --</option>
                                    {corporateCustomersList.map(c => (
                                        <option key={c.email} value={c.email}>{c.companyName} ({c.email}) — [{c.frequency}]</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Corporate Account Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={cfgEmail}
                                    onChange={e => setCfgEmail(e.target.value)}
                                    placeholder="corporate@company.com"
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Company Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={cfgCompanyName}
                                    onChange={e => setCfgCompanyName(e.target.value)}
                                    placeholder="e.g. Dialog / MAS / John Keells"
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Registered Billing Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={cfgBillingEmail}
                                    onChange={e => setCfgBillingEmail(e.target.value)}
                                    placeholder="finance@company.com"
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Invoice Frequency *</label>
                                <select
                                    value={cfgFrequency}
                                    onChange={e => setCfgFrequency(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)' }}
                                >
                                    <option value="Every 15 Days">Every 15 Days (1st–15th &amp; 16th–Last Day)</option>
                                    <option value="Monthly">Monthly (1st–Last Day of Month)</option>
                                    <option value="Per Service">Per Service / Shipment</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Payment Terms *</label>
                                <select
                                    value={cfgPaymentTerms}
                                    onChange={e => setCfgPaymentTerms(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)' }}
                                >
                                    <option value="Net 15 Days">Net 15 Days</option>
                                    <option value="Net 30 Days">Net 30 Days</option>
                                    <option value="Due on Receipt">Due on Receipt</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                            <button type="button" onClick={() => setShowConfigForm(false)} className="secondary-btn" style={{ width: 'auto', padding: '0.5rem 1rem', height: 'auto' }}>Cancel</button>
                            <button type="submit" disabled={savingConfig} className="primary-btn" style={{ width: 'auto', padding: '0.5rem 1.25rem', height: 'auto', background: '#9333ea' }}>
                                {savingConfig ? 'Saving...' : 'Save Corporate Billing Profile'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Generator Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Corporate Customer</label>
                        <select
                            value={selectedCorpEmail}
                            onChange={e => setSelectedCorpEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.9)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.88rem' }}
                        >
                            <option value="">All Corporate Customers ({uninvoicedBillableAtrs.length} uninvoiced requests)</option>
                            {corporateCustomersList.map(c => (
                                <option key={c.email} value={c.email}>{c.companyName} ({c.email}) — [{c.frequency}]</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Billing Period / Cycle</label>
                        <select
                            value={selectedPeriodMode}
                            onChange={e => setSelectedPeriodMode(e.target.value)}
                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.9)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.88rem' }}
                        >
                            <option value="all_uninvoiced">All Eligible Uninvoiced Shipments (Consolidated)</option>
                            <option value="first_half">Every 15 Days — Period 1 (1st to 15th)</option>
                            <option value="second_half">Every 15 Days — Period 2 (16th to End of Month)</option>
                            <option value="full_month">Monthly — Full Month (1st to Last Day of Month)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Billing Month</label>
                        <input
                            type="month"
                            value={selectedYearMonth}
                            onChange={e => setSelectedYearMonth(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.9)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.88rem', colorScheme: 'dark' }}
                        />
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={handleRunBillingCycle}
                            disabled={runningCycle}
                            className="primary-btn pulse-effect"
                            style={{ width: '100%', height: '42px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.9rem', fontWeight: 700 }}
                        >
                            {runningCycle ? (
                                <><i className='bx bx-loader-alt bx-spin'></i> Generating &amp; Emailing PDF...</>
                            ) : (
                                <><i className='bx bx-send'></i> Generate &amp; Email Consolidated Invoice</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Invoice Management List & Filter Bar */}
            <div className="action-card" style={{ padding: '2rem', border: '1px solid var(--card-border)', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.4rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className='bx bx-receipt' style={{ color: 'var(--accent-color)' }}></i> Invoice Management &amp; Audit History
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
                            View, filter, download PDF invoices, track payments, and resend or retry invoice emails.
                        </p>
                    </div>
                    <button
                        onClick={loadInvoicesData}
                        className="secondary-btn"
                        style={{ width: 'auto', padding: '0.5rem 1rem', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}
                    >
                        <i className='bx bx-refresh'></i> Refresh Invoices
                    </button>
                </div>

                {/* Filter Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.85rem', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)', marginBottom: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Search Customer / Invoice #</label>
                        <input
                            type="text"
                            placeholder="e.g. INV-CORP, Wanith, PD-6..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Customer Type</label>
                        <select
                            value={filterCustomerType}
                            onChange={e => setFilterCustomerType(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem' }}
                        >
                            <option value="all">All Types</option>
                            <option value="Corporate">🏢 Corporate</option>
                            <option value="Personal">👤 Personal</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Payment Status</label>
                        <select
                            value={filterPaymentStatus}
                            onChange={e => setFilterPaymentStatus(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem' }}
                        >
                            <option value="all">All Payment Statuses</option>
                            <option value="Unpaid">⏳ Unpaid</option>
                            <option value="Partially Paid">🌗 Partially Paid</option>
                            <option value="Paid">✅ Paid</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email Status</label>
                        <select
                            value={filterEmailStatus}
                            onChange={e => setFilterEmailStatus(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem' }}
                        >
                            <option value="all">All Email Statuses</option>
                            <option value="Sent">📩 Sent</option>
                            <option value="Pending">⏳ Pending</option>
                            <option value="Failed">⚠️ Failed</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Billing Period</label>
                        <input
                            type="text"
                            placeholder="e.g. 2026-11-01"
                            value={filterBillingPeriod}
                            onChange={e => setFilterBillingPeriod(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Issue Date</label>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem', colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                {/* Invoices List */}
                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}><i className='bx bx-loader-alt bx-spin'></i> Loading invoices...</p>
                ) : filteredInvoices.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px dashed var(--card-border)' }}>
                        <i className='bx bx-receipt' style={{ fontSize: '2.5rem', opacity: 0.5, marginBottom: '0.5rem', display: 'block' }}></i>
                        No invoices match the current filters. Accept a Personal Delivery or click <strong>"Generate &amp; Email Consolidated Invoice"</strong> above to create one!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredInvoices.map(inv => {
                            const isCorp = inv.customer_type === 'Corporate';
                            const payBadge = inv.payment_status === 'Paid'
                                ? { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }
                                : inv.payment_status === 'Partially Paid'
                                ? { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }
                                : { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };

                            const emailBadge = inv.email_status === 'Sent'
                                ? { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', label: '📩 Email Sent' }
                                : inv.email_status === 'Failed'
                                ? { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: '⚠️ Email Failed' }
                                : { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', label: '⏳ Email Pending' };

                            return (
                                <div
                                    key={inv.invoice_id}
                                    style={{
                                        padding: '1.35rem',
                                        background: 'rgba(255,255,255,0.025)',
                                        border: '1px solid var(--card-border)',
                                        borderLeft: isCorp ? '4px solid #3b82f6' : '4px solid #ea580c',
                                        borderRadius: '14px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '1rem'
                                    }}
                                >
                                    <div style={{ flex: '1 1 360px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                                                #{inv.invoice_number}
                                            </span>
                                            <span style={{
                                                padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.73rem', fontWeight: 700,
                                                background: isCorp ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 88, 12, 0.15)',
                                                color: isCorp ? '#60a5fa' : '#fb923c'
                                            }}>
                                                {isCorp ? '🏢 Corporate' : '👤 Personal'} ({inv.invoice_frequency || 'Single'})
                                            </span>
                                            <span style={{
                                                padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700,
                                                background: payBadge.bg, color: payBadge.color, border: payBadge.border
                                            }}>
                                                {inv.payment_status}
                                            </span>
                                            <span style={{
                                                padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600,
                                                background: emailBadge.bg, color: emailBadge.color
                                            }} title={inv.email_error || ''}>
                                                {emailBadge.label}
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                                            <div>
                                                <strong>Invoice To:</strong>{' '}
                                                <span style={{ color: '#fff', fontWeight: 700 }}>
                                                    {parseCorporateDisplay(inv.customer_name, inv.company_name, inv.department_name).company}
                                                </span>
                                                {isCorp && (
                                                    <span style={{ color: '#60a5fa', fontWeight: 600, marginLeft: '0.35rem' }}>
                                                        ({inv.department_name || 'Operations Department'})
                                                    </span>
                                                )}
                                            </div>
                                            <div><strong>Billing Email:</strong> {inv.billing_email || inv.customer_email}</div>
                                            <div><strong>Billing Period:</strong> {inv.billing_period_label || inv.issue_date}</div>
                                            <div><strong>Issue Date:</strong> {inv.issue_date}</div>
                                            <div><strong>Shipments:</strong> {inv.total_shipments || (inv.line_items?.length || 1)} request(s) ({(inv.line_items || []).map(li => li.ref_number).join(', ')})</div>
                                            <div>
                                                <strong>Total Payable:</strong>{' '}
                                                <span style={{ color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.95rem' }}>
                                                    LKR {Number(inv.total_payable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                        {inv.email_error && (
                                            <div style={{ marginTop: '0.45rem', color: '#f87171', fontSize: '0.78rem' }}>
                                                ⚠️ Last email error: {inv.email_error}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                        <select
                                            value={inv.payment_status || 'Unpaid'}
                                            disabled={updatingPaymentId === inv.invoice_id}
                                            onChange={e => handleUpdatePaymentStatus(inv, e.target.value)}
                                            style={{ padding: '0.45rem 0.65rem', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.8rem', cursor: 'pointer' }}
                                            title="Update Payment Status"
                                        >
                                            <option value="Unpaid">⏳ Mark Unpaid</option>
                                            <option value="Partially Paid">🌗 Partially Paid</option>
                                            <option value="Paid">✅ Mark Paid</option>
                                        </select>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedInvoice(inv)}
                                            className="secondary-btn"
                                            style={{ width: 'auto', padding: '0.45rem 0.85rem', height: 'auto', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--card-border)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                        >
                                            <i className='bx bx-show'></i> View Details
                                        </button>

                                        <a
                                            href={`${API_BASE}/api/invoices/${encodeURIComponent(inv.invoice_id)}/pdf`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="secondary-btn"
                                            style={{ width: 'auto', padding: '0.45rem 0.85rem', height: 'auto', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                                        >
                                            <i className='bx bxs-file-pdf'></i> Download PDF
                                        </a>

                                        <button
                                            type="button"
                                            disabled={resendingId === inv.invoice_id}
                                            onClick={() => handleResendInvoice(inv)}
                                            className="secondary-btn"
                                            style={{ width: 'auto', padding: '0.45rem 0.85rem', height: 'auto', fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.14)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                                        >
                                            <i className={`bx ${resendingId === inv.invoice_id ? 'bx-loader-alt bx-spin' : 'bx-mail-send'}`}></i>
                                            {inv.email_status === 'Failed' ? 'Retry Email' : 'Resend PDF'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 4. Invoice Details & Associated Shipments Modal */}
            {selectedInvoice && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
                    onClick={() => setSelectedInvoice(null)}
                >
                    <div
                        style={{ background: '#18181b', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '2rem', maxWidth: '760px', width: '100%', maxHeight: '88vh', overflowY: 'auto', textAlign: 'left', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                            <div>
                                <h3 style={{ color: '#fff', margin: 0, fontSize: '1.35rem', fontFamily: 'monospace' }}>
                                    Invoice #{selectedInvoice.invoice_number}
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                                    {selectedInvoice.customer_type} Invoice • Billing Period: {selectedInvoice.billing_period_label}
                                </p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.6rem', cursor: 'pointer' }}>
                                <i className='bx bx-x'></i>
                            </button>
                        </div>

                        {/* Customer & Billing Summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Billed To</div>
                                <div style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 800 }}>
                                    {parseCorporateDisplay(selectedInvoice.customer_name, selectedInvoice.company_name, selectedInvoice.department_name).company}
                                </div>
                                {selectedInvoice.customer_type === 'Corporate' && (
                                    <div style={{ color: '#60a5fa', fontWeight: 700, marginTop: '0.15rem' }}>
                                        {selectedInvoice.department_name || 'Operations Department'}
                                    </div>
                                )}
                                <div style={{ marginTop: '0.15rem' }}>
                                    Attn: {parseCorporateDisplay(selectedInvoice.customer_name, selectedInvoice.company_name, selectedInvoice.department_name).officer}
                                </div>
                                <div>Address: {selectedInvoice.billing_address || 'Sri Lanka'}</div>
                                <div>Email: {selectedInvoice.billing_email || selectedInvoice.customer_email} | Tel: {selectedInvoice.customer_phone || 'N/A'}</div>
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontWeight: 700, marginBottom: '0.25rem' }}>Invoice &amp; Payment Info</div>
                                <div>Issue Date: {selectedInvoice.issue_date}</div>
                                <div>Frequency: {selectedInvoice.invoice_frequency}</div>
                                <div>Payment Terms: {selectedInvoice.payment_terms}</div>
                                <div>Payment Status: <strong style={{ color: '#10b981' }}>{selectedInvoice.payment_status}</strong> (Paid: LKR {Number(selectedInvoice.amount_paid || 0).toLocaleString()})</div>
                            </div>
                        </div>

                        {/* Associated Courier Requests Table */}
                        <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                            Associated Courier Requests ({selectedInvoice.line_items?.length || 0})
                        </h4>
                        <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', color: '#e2e8f0' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.06)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.65rem' }}>Ref #</th>
                                        <th style={{ padding: '0.65rem' }}>Date</th>
                                        <th style={{ padding: '0.65rem' }}>Pickup &amp; Delivery Details</th>
                                        <th style={{ padding: '0.65rem' }}>Service / Parcel</th>
                                        <th style={{ padding: '0.65rem', textAlign: 'right' }}>Charge (LKR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedInvoice.line_items || []).map((li, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                            <td style={{ padding: '0.65rem', fontWeight: 700, fontFamily: 'monospace' }}>{li.ref_number}</td>
                                            <td style={{ padding: '0.65rem' }}>{li.shipment_date}</td>
                                            <td style={{ padding: '0.65rem' }}>{li.pickup_details} &rarr; {li.delivery_details}</td>
                                            <td style={{ padding: '0.65rem' }}>
                                                <div>{li.parcel_or_vehicle}</div>
                                                {li.distance_km != null && li.rate_lkr != null && (
                                                    <div style={{ fontSize: '0.74rem', color: li.is_actual ? '#10b981' : '#94a3b8', marginTop: '0.15rem' }}>
                                                        {li.distance_km} km @ LKR {li.rate_lkr}/km{' '}
                                                        <span style={{ fontWeight: 700 }}>
                                                            ({li.is_actual ? 'Actual' : 'Estimated'})
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700 }}>
                                                LKR {Number(li.amount_lkr || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem 1.35rem', borderRadius: '12px', minWidth: '250px', fontSize: '0.88rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                                    <strong>LKR {Number(selectedInvoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Taxes / Additional:</span>
                                    <span>LKR {Number((selectedInvoice.tax_amount || 0) + (selectedInvoice.additional_charges || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--card-border)', paddingTop: '0.45rem', marginTop: '0.45rem', fontSize: '1rem', color: 'var(--accent-color)', fontWeight: 800 }}>
                                    <span>Total Payable:</span>
                                    <span>LKR {Number(selectedInvoice.total_payable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Audit Log */}
                        {selectedInvoice.audit_log && selectedInvoice.audit_log.length > 0 && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Audit Trail &amp; History</h4>
                                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {selectedInvoice.audit_log.map((entry, idx) => (
                                        <div key={idx}>
                                            <strong style={{ color: '#cbd5e1' }}>[{new Date(entry.timestamp).toLocaleString()}]</strong>{' '}
                                            <span style={{ color: '#60a5fa' }}>{entry.action}</span> — {entry.note} ({entry.actor})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <a
                                href={`${API_BASE}/api/invoices/${encodeURIComponent(selectedInvoice.invoice_id)}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="primary-btn"
                                style={{ width: 'auto', padding: '0.6rem 1.2rem', height: 'auto', background: '#10b981', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
                            >
                                <i className='bx bxs-file-pdf'></i> Download Official PDF Invoice
                            </a>
                            <button
                                type="button"
                                onClick={() => handleResendInvoice(selectedInvoice)}
                                className="secondary-btn"
                                style={{ width: 'auto', padding: '0.6rem 1.2rem', height: 'auto', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '0.88rem' }}
                            >
                                <i className='bx bx-mail-send'></i> Resend Email
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="secondary-btn"
                                style={{ width: 'auto', padding: '0.6rem 1.2rem', height: 'auto', fontSize: '0.88rem' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceManagementPanel;
