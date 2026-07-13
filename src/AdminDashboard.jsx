import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const AdminDashboard = ({ assignedStaff = [], onAssignStaff, onRemoveStaff, loggedInUser }) => {
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [assignStatus, setAssignStatus] = useState('');
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staffDetailsLoading, setStaffDetailsLoading] = useState(false);
    const [selectedStat, setSelectedStat] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Ride Assignment and Rider Availability State
    const [activeTab, setActiveTab] = useState('overview');
    const [ridersList, setRidersList] = useState([]);
    const [atrRequests, setAtrRequests] = useState([]);
    const [loadingRiders, setLoadingRiders] = useState(false);
    const [loadingAtr, setLoadingAtr] = useState(false);

    const loadRiders = async () => {
        setLoadingRiders(true);
        try {
            const { data, error } = await supabase
                .from('staff')
                .select('staff_id, staff_name, staff_email, staff_phone, staff_role, staff_active_status, branch_id, availability_status')
                .eq('staff_role', 'staff');
            if (error) throw error;
            setRidersList(data || []);
        } catch (err) {
            console.error('Error loading riders:', err);
        } finally {
            setLoadingRiders(false);
        }
    };

    const loadAtrRequests = async () => {
        setLoadingAtr(true);
        try {
            const { data, error } = await supabase
                .from('atr')
                .select('*')
                .order('atr_id', { ascending: false });
            if (error) throw error;
            setAtrRequests(data || []);
        } catch (err) {
            console.error('Error loading ATR requests:', err);
        } finally {
            setLoadingAtr(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'rides') {
            loadRiders();
            loadAtrRequests();
        }
    }, [activeTab]);

    const handleAssignRider = async (atrId, riderId) => {
        try {
            const { error } = await supabase
                .from('atr')
                .update({ rider_id: riderId ? parseInt(riderId) : null })
                .eq('atr_id', atrId);
            
            if (error) throw error;

            if (riderId) {
                await supabase
                    .from('staff')
                    .update({ availability_status: 'Busy' })
                    .eq('staff_id', parseInt(riderId));
            }

            alert('Rider assigned successfully!');
            loadAtrRequests();
            loadRiders();
        } catch (err) {
            console.error('Error assigning rider:', err);
            alert('Failed to assign rider: ' + err.message);
        }
    };

    const handleUpdateRiderStatus = async (staffId, newStatus) => {
        try {
            const { error } = await supabase
                .from('staff')
                .update({ availability_status: newStatus })
                .eq('staff_id', staffId);
            if (error) throw error;
            
            alert('Rider status updated!');
            loadRiders();
        } catch (err) {
            console.error('Error updating rider status:', err);
            alert('Failed to update rider status: ' + err.message);
        }
    };

    // Registration Form Fields State
    const [regFullName, setRegFullName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regRole, setRegRole] = useState('staff');
    const [regBranchId, setRegBranchId] = useState('');

    // Success Screen State
    const [registeredCredentials, setRegisteredCredentials] = useState(null);
    const [sendEmailAddress, setSendEmailAddress] = useState('');
    const [copiedField, setCopiedField] = useState(null);
    const [sendingEmail, setSendingEmail] = useState(false);

    // Branches state
    const [branches, setBranches] = useState([]);

    // Fetch branches from Supabase on mount
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const { data, error } = await supabase.from('branch').select('*');
                if (error) throw error;
                setBranches(data || []);
                if (data && data.length > 0) {
                    setRegBranchId(data[0].branch_id);
                }
            } catch (err) {
                console.error('Failed to load branches:', err);
            }
        };
        fetchBranches();
    }, []);

    // Load staff from Supabase on mount
    useEffect(() => {
        const loadStaff = async () => {
            const { data, error } = await supabase
                .from('staff')
                .select('staff_email')
                .eq('staff_role', 'staff');
            if (data && !error) {
                data.forEach(s => {
                    if (s.staff_email && onAssignStaff) onAssignStaff(s.staff_email);
                });
            }
        };
        loadStaff();
    }, []);

    // SHA-256 client-side hashing helper
    const hashPasswordClient = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // Credentials Clipboard Copy Actions
    const handleCopy = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleCopyAll = () => {
        if (!registeredCredentials) return;
        const text = `Staff Assigned Successfully\n\nUsername: ${registeredCredentials.username}\nTemporary Password: ${registeredCredentials.tempPassword}`;
        navigator.clipboard.writeText(text);
        setCopiedField('all');
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Send Credentials via Express Backend Nodemailer
    const handleSendEmail = async () => {
        if (!registeredCredentials || !sendEmailAddress.trim()) {
            alert('Please enter a destination email address.');
            return;
        }
        setSendingEmail(true);
        try {
            const res = await fetch('http://localhost:5000/api/admin/send-staff-credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    personalEmail: sendEmailAddress.trim(),
                    username: registeredCredentials.username,
                    password: registeredCredentials.tempPassword,
                    staffName: registeredCredentials.staffName
                }),
            });
            const data = await res.json();
            if (res.ok) {
                let msg = 'Credentials email sent successfully!';
                if (data.previewUrl) {
                    msg += `\n\n(Local Dev Ethereal Mail link: ${data.previewUrl})`;
                }
                alert(msg);
            } else {
                alert('Failed to send email: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Email dispatch error:', err);
            alert('Failed to send email. Please ensure the backend server is running on http://localhost:5000.');
        } finally {
            setSendingEmail(false);
        }
    };

    // Full Staff Registration submission
    const handleAssignStaff = async (e) => {
        e.preventDefault();
        
        // 1. Validate all required fields
        if (!regFullName.trim() || !regPhone.trim() || !regRole || !regBranchId) {
            alert('All fields are required');
            return;
        }

        const phoneTrimmed = regPhone.trim();
        if (phoneTrimmed.length < 9 || phoneTrimmed.length > 15 || !/^\+?[0-9]+$/.test(phoneTrimmed)) {
            alert('Invalid contact number format (9 to 15 digits expected)');
            return;
        }

        setAssignStatus('assigning');

        try {
            // 2. Ensure Contact Number is unique
            const { data: dupPhone } = await supabase
                .from('staff')
                .select('staff_id')
                .eq('staff_phone', phoneTrimmed);

            if (dupPhone && dupPhone.length > 0) {
                alert('Contact Number is already in use by another staff member');
                setAssignStatus('');
                return;
            }

            // 3. Generate a unique username in the format: username@sccourier.com
            const baseName = regFullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            const base = baseName || 'staff';
            const domain = '@sccourier.com';
            let generatedUsername = `${base}${domain}`;

            // Fetch existing matching usernames to append sequential numbers if duplicate
            const { data: matches, error: matchErr } = await supabase
                .from('staff')
                .select('staff_email')
                .like('staff_email', `${base}%${domain}`);

            if (matchErr) throw matchErr;

            const existingUsernames = matches ? matches.map(m => m.staff_email) : [];
            let counter = 1;
            while (existingUsernames.includes(generatedUsername)) {
                generatedUsername = `${base}${counter}${domain}`;
                counter++;
            }

            // 4. Automatically generate a secure temporary password
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
            const tempPassword = rawPassword.split('').sort(() => Math.random() - 0.5).join('');

            // 5. Store generated username and encrypted (hashed) password along with staff details
            const hashedPassword = await hashPasswordClient(tempPassword);

            const { error: insertErr } = await supabase
                .from('staff')
                .insert({
                    staff_name: regFullName.trim(),
                    staff_phone: phoneTrimmed,
                    branch_id: parseInt(regBranchId),
                    staff_role: regRole,
                    staff_active_status: true,
                    staff_email: generatedUsername,
                    staff_password: hashedPassword
                });

            if (insertErr) throw insertErr;

            setAssignStatus('success');
            if (onAssignStaff) onAssignStaff(generatedUsername);
            
            // Set credentials to trigger Success message view
            setRegisteredCredentials({
                username: generatedUsername,
                tempPassword,
                staffName: regFullName.trim()
            });

            // Reset inputs
            setRegFullName('');
            setRegPhone('');
            setRegRole('staff');
        } catch (err) {
            console.error('Assign staff error:', err);
            alert('Failed to assign staff: ' + (err.message || err));
            setAssignStatus('');
        }
    };

    const handleStaffClick = async (email) => {
        setStaffDetailsLoading(true);
        setSelectedStaff(null);

        try {
            const { data, error } = await supabase
                .from('staff')
                .select('staff_id, staff_name, staff_email, staff_phone, staff_role, staff_active_status, branch_id')
                .eq('staff_email', email)
                .single();

            if (error) throw error;

            setSelectedStaff(data);
        } catch (err) {
            console.error('Load staff details error:', err);
            alert('Could not load staff details.');
        } finally {
            setStaffDetailsLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const [
                staffRes,
                atrRes,
                courierRes,
                customerRes,
                invoiceRes,
                paymentRes
            ] = await Promise.all([
                supabase.from('staff').select('*'),
                supabase.from('atr').select('*'),
                supabase.from('courier_req').select('*'),
                supabase.from('customer').select('*'),
                supabase.from('invoice').select('*'),
                supabase.from('payment').select('*')
            ]);

            const staffData = staffRes.status === 'fulfilled' && !staffRes.value.error ? staffRes.value.data : [];
            const atrData = atrRes.status === 'fulfilled' && !atrRes.value.error ? atrRes.value.data : [];
            const courierData = courierRes.status === 'fulfilled' && !courierRes.value.error ? courierRes.value.data : [];
            const customerData = customerRes.status === 'fulfilled' && !customerRes.value.error ? customerRes.value.data : [];
            const invoiceData = invoiceRes.status === 'fulfilled' && !invoiceRes.value.error ? invoiceRes.value.data : [];
            const paymentData = paymentRes.status === 'fulfilled' && !paymentRes.value.error ? paymentRes.value.data : [];

            // Calculate overview stats
            const totalStaff = staffData.length;
            const totalRiders = staffData.filter(s => s.staff_role === 'staff').length;
            const activeRiders = staffData.filter(s => s.staff_role === 'staff' && s.staff_active_status).length;
            const busyRiders = staffData.filter(s => s.staff_role === 'staff' && s.availability_status === 'Busy').length;

            const totalCustomers = customerData.length;
            const individualCustomers = customerData.filter(c => c.cust_type?.toLowerCase() === 'individual').length;
            const corporateCustomers = customerData.filter(c => c.cust_type?.toLowerCase() === 'corporate').length;

            const totalATRs = atrData.length;
            const approvedATRs = atrData.filter(a => a.status === 'Approved').length;
            const pendingATRs = atrData.filter(a => a.status === 'Pending').length;
            const completedATRs = atrData.filter(a => a.status === 'Completed').length;
            const totalEstCost = atrData.reduce((acc, a) => acc + Number(a.estimated_cost || 0), 0);
            const totalActCost = atrData.reduce((acc, a) => acc + Number(a.actual_cost || 0), 0);

            const totalCouriers = courierData.length;
            const pendingCouriers = courierData.filter(c => c.status === 'Pending').length;
            const deliveredCouriers = courierData.filter(c => c.status === 'Delivered').length;

            const totalInvoiced = invoiceData.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
            const totalPaid = paymentData.filter(p => p.status === 'Success' || p.status === 'success' || p.status === 'Paid' || p.status === 'paid').reduce((acc, p) => acc + Number(p.amount || 0), 0);

            // Construct CSV
            let csvContent = '';
            const appendLine = (line) => { csvContent += line + '\n'; };
            const appendEmptyRow = () => { csvContent += '\n'; };

            // Helper to escape CSV values
            const esc = (val) => {
                if (val === null || val === undefined) return '';
                let str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            // 1. Report Header
            appendLine('=== SC COURIER SERVICES - SYSTEM REPORT ===');
            appendLine(`Report Type,Full System Summary Report`);
            appendLine(`Generated At,${new Date().toLocaleString()}`);
            appendLine(`Generated By,${loggedInUser?.email || loggedInUser?.staff_email || 'Admin'}`);
            appendEmptyRow();

            // 2. Summary Statistics Section
            appendLine('=== SUMMARY STATISTICS ===');
            appendLine('Category,Metric,Value');
            appendLine(`Staff,Total Registered Staff,${totalStaff}`);
            appendLine(`Staff,Total Courier Riders,${totalRiders}`);
            appendLine(`Staff,Active Riders,${activeRiders}`);
            appendLine(`Staff,Busy Riders,${busyRiders}`);
            appendLine(`Customer,Total Registered Customers,${totalCustomers}`);
            appendLine(`Customer,Individual Customers,${individualCustomers}`);
            appendLine(`Customer,Corporate Customers,${corporateCustomers}`);
            appendLine(`ATR Requests,Total ATR Requests,${totalATRs}`);
            appendLine(`ATR Requests,Approved ATRs,${approvedATRs}`);
            appendLine(`ATR Requests,Pending ATRs,${pendingATRs}`);
            appendLine(`ATR Requests,Completed ATRs,${completedATRs}`);
            appendLine(`ATR Requests,Total Estimated Cost (LKR),${totalEstCost.toFixed(2)}`);
            appendLine(`ATR Requests,Total Actual Cost (LKR),${totalActCost.toFixed(2)}`);
            appendLine(`Courier Bookings,Total Bookings,${totalCouriers}`);
            appendLine(`Courier Bookings,Pending Bookings,${pendingCouriers}`);
            appendLine(`Courier Bookings,Delivered Bookings,${deliveredCouriers}`);
            appendLine(`Finance,Total Invoiced Amount (LKR),${totalInvoiced.toFixed(2)}`);
            appendLine(`Finance,Total Payments Received (LKR),${totalPaid.toFixed(2)}`);
            appendEmptyRow();

            // 3. Staff List
            appendLine('=== REGISTERED STAFF MEMBERS ===');
            appendLine('Staff ID,Name,Email,Phone,Role,Status,Availability Status');
            staffData.forEach(s => {
                appendLine([
                    esc(s.staff_id),
                    esc(s.staff_name),
                    esc(s.staff_email),
                    esc(s.staff_phone),
                    esc(s.staff_role),
                    esc(s.staff_active_status ? 'Active' : 'Inactive'),
                    esc(s.availability_status || 'Available')
                ].join(','));
            });
            appendEmptyRow();

            // 4. Customers List
            appendLine('=== REGISTERED CUSTOMERS ===');
            appendLine('Customer ID,Name,Email,Address,Phone,Type,Joined Date');
            customerData.forEach(c => {
                appendLine([
                    esc(c.customer_id),
                    esc(c.cust_name),
                    esc(c.cust_email),
                    esc(c.cust_address),
                    esc(c.cust_phoneno),
                    esc(c.cust_type),
                    esc(c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A')
                ].join(','));
            });
            appendEmptyRow();

            // 5. ATR Requests List
            appendLine('=== ATR TRAVEL REQUESTS ===');
            appendLine('ATR ID,ATR Number,Required Date,Required Time,Passenger Name,Passenger Designation,Vehicle Type,Purpose of Travel,Est. Distance,Est. Cost (LKR),Actual Distance,Actual Cost (LKR),Status');
            atrData.forEach(a => {
                appendLine([
                    esc(a.atr_id),
                    esc(a.atr_number),
                    esc(a.required_date),
                    esc(a.required_time),
                    esc(a.principal_passenger_name),
                    esc(a.principal_passenger_designation),
                    esc(a.vehicle_type),
                    esc(a.purpose_of_travel),
                    esc(a.estimated_distance),
                    esc(a.estimated_cost),
                    esc(a.actual_distance),
                    esc(a.actual_cost),
                    esc(a.status)
                ].join(','));
            });
            appendEmptyRow();

            // 6. Courier Requests List
            appendLine('=== COURIER BOOKINGS ===');
            appendLine('Book ID,Customer ID,ATR ID,Receiver NIC,Courier Date,Weight,Status,Created At');
            courierData.forEach(c => {
                appendLine([
                    esc(c.book_id),
                    esc(c.customer_id),
                    esc(c.atr_id),
                    esc(c.rec_nic),
                    esc(c.courier_date),
                    esc(c.courier_weight),
                    esc(c.status),
                    esc(c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A')
                ].join(','));
            });
            appendEmptyRow();

            // 7. Invoice & Payments List
            appendLine('=== INVOICES ===');
            appendLine('Invoice ID,Invoice Type,Customer ID,Rider ID,Issue Date,Total Amount (LKR),Payment Status');
            invoiceData.forEach(i => {
                appendLine([
                    esc(i.invoice_id),
                    esc(i.invoice_type),
                    esc(i.customer_id),
                    esc(i.rider_id),
                    esc(i.issue_date),
                    esc(i.total_amount),
                    esc(i.payment_status)
                ].join(','));
            });

            // Trigger file download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `SC_Courier_Full_Report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert('Report generated and downloaded successfully!');
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report: ' + error.message);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // Sample dummy data for admin view
    const stats = [
        {
            id: 'deliveries',
            title: 'Total Deliveries',
            value: '1,284',
            icon: 'bx-package',
            color: 'var(--success)',
        },
        {
            id: 'couriers',
            title: 'Active Couriers',
            value: '42',
            icon: 'bx-run',
            color: 'var(--accent-color)',
        },
        {
            id: 'routes',
            title: 'Pending Routes',
            value: '15',
            icon: 'bx-map-alt',
            color: '#f59e0b',
        },
    ];

    const statDetails = {
        deliveries: {
            title: 'Total Deliveries',
            icon: 'bx-package',
            description: 'All deliveries recorded in the system.',
            rows: [
                { label: 'Delivered', value: '986' },
                { label: 'In Transit', value: '214' },
                { label: 'Pending', value: '84' },
            ],
        },
        couriers: {
            title: 'Active Couriers',
            icon: 'bx-run',
            description: 'Courier staff currently active and available.',
            rows: [
                { label: 'Available Couriers', value: '28' },
                { label: 'On Delivery', value: '12' },
                { label: 'On Break', value: '2' },
            ],
        },
        routes: {
            title: 'Pending Routes',
            icon: 'bx-map-alt',
            description: 'Routes waiting to be assigned or completed.',
            rows: [
                { label: 'Awaiting Assignment', value: '7' },
                { label: 'Delayed Routes', value: '3' },
                { label: 'Scheduled Today', value: '5' },
            ],
        },
    };

    const recentOrders = [
        { id: 'SC101000', customer: 'John Doe', destination: 'Seattle, WA', status: 'In Transit' },
        { id: 'SC101015', customer: 'Jane Smith', destination: 'Denver, CO', status: 'Pending' },
        { id: 'SC101018', customer: 'Bob Johnson', destination: 'Miami, FL', status: 'Delivered' },
    ];

    return (
        <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease', padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', zIndex: 10 }}>
            {/* Header */}
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                        <i className='bx bx-shield-quarter'></i> Admin Dashboard
                    </h2>
                    <p style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>System overview and management</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className="secondary-btn" onClick={() => setShowAssignForm(!showAssignForm)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '44px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}>
                        <i className='bx bx-user-plus'></i> Assign Staff
                    </button>
                    <button 
                        className="primary-btn pulse-effect" 
                        onClick={handleGenerateReport} 
                        disabled={isGeneratingReport} 
                        style={{ 
                            width: 'auto', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            background: '#f59e0b', 
                            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', 
                            height: '44px',
                            cursor: isGeneratingReport ? 'not-allowed' : 'pointer',
                            opacity: isGeneratingReport ? 0.8 : 1
                        }}
                    >
                        {isGeneratingReport ? (
                            <><i className='bx bx-loader-alt bx-spin'></i> Generating...</>
                        ) : (
                            <><i className='bx bx-printer'></i> Generate Report</>
                        )}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--card-border)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
                <button 
                    onClick={() => setActiveTab('overview')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: activeTab === 'overview' ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        padding: '0.5rem 1.5rem',
                        cursor: 'pointer',
                        borderBottom: activeTab === 'overview' ? '3px solid var(--accent-color)' : '3px solid transparent',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <i className='bx bx-grid-alt'></i> Overview & Staff
                </button>
                <button 
                    onClick={() => setActiveTab('rides')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: activeTab === 'rides' ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        padding: '0.5rem 1.5rem',
                        cursor: 'pointer',
                        borderBottom: activeTab === 'rides' ? '3px solid var(--accent-color)' : '3px solid transparent',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <i className='bx bx-navigation'></i> Ride Assignment
                </button>
            </div>

            {activeTab === 'overview' && (
                <>
                    {/* Assign Staff Form (conditional) */}
                    {showAssignForm && (
                <div className="action-card" style={{ marginBottom: '2rem', animation: 'slideInDown 0.4s ease', padding: '2rem', border: '1px solid var(--card-border)', maxWidth: '100%', width: '100%' }}>
                    {registeredCredentials ? (
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                                    <i className='bx bx-check-shield'></i>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: 0 }}>Staff Assigned Successfully</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Credentials generated and saved securely.</p>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                                <div style={{ marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Generated Username</label>
                                        <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', fontFamily: 'monospace' }}>{registeredCredentials.username}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleCopy(registeredCredentials.username, 'username')}
                                        className="secondary-btn" 
                                        style={{ padding: '0.5rem 0.8rem', height: 'auto', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                                    >
                                        <i className={`bx ${copiedField === 'username' ? 'bx-check text-success' : 'bx-copy'}`}></i>
                                        {copiedField === 'username' ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Temporary Password</label>
                                        <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', fontFamily: 'monospace' }}>{registeredCredentials.tempPassword}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleCopy(registeredCredentials.tempPassword, 'password')}
                                        className="secondary-btn" 
                                        style={{ padding: '0.5rem 0.8rem', height: 'auto', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                                    >
                                        <i className={`bx ${copiedField === 'password' ? 'bx-check text-success' : 'bx-copy'}`}></i>
                                        {copiedField === 'password' ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', borderBottom: '1px solid var(--card-border)', paddingBottom: '1.5rem' }}>
                                <div className="form-control" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Staff Contact/Personal Email</label>
                                    <div className="input-wrapper" style={{ position: 'relative' }}>
                                        <i className='bx bx-envelope input-icon' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}></i>
                                        <input
                                            type="email"
                                            placeholder="e.g. staff@gmail.com"
                                            value={sendEmailAddress}
                                            onChange={(e) => setSendEmailAddress(e.target.value)}
                                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail || !sendEmailAddress.trim()}
                                    className="primary-btn" 
                                    style={{ width: 'auto', height: '46px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-color)', boxShadow: '0 4px 14px 0 var(--accent-glow)' }}
                                >
                                    {sendingEmail ? (
                                        <><i className='bx bx-loader-alt bx-spin'></i> Sending...</>
                                    ) : (
                                        <><i className='bx bx-envelope'></i> Send Credentials via Email</>
                                    )}
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button 
                                    onClick={handleCopyAll}
                                    className="primary-btn" 
                                    style={{ width: 'auto', height: '44px', padding: '0 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)' }}
                                >
                                    <i className={`bx ${copiedField === 'all' ? 'bx-check' : 'bx-copy'}`}></i>
                                    {copiedField === 'all' ? 'Credentials Copied!' : 'Copy All Credentials'}
                                </button>
                                <button 
                                    onClick={() => {
                                        setRegisteredCredentials(null);
                                        setSendEmailAddress('');
                                    }}
                                    className="secondary-btn" 
                                    style={{ width: 'auto', height: '44px', padding: '0 1.2rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    Assign Another Staff
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleAssignStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                                <i className='bx bx-user-check' style={{ color: 'var(--accent-color)' }}></i> Register & Assign New Staff
                            </h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                                <div className="form-control" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Full Name</label>
                                    <div className="input-wrapper" style={{ position: 'relative' }}>
                                        <i className='bx bx-user input-icon' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}></i>
                                        <input
                                            type="text"
                                            placeholder="e.g. John Doe"
                                            required
                                            value={regFullName}
                                            onChange={(e) => setRegFullName(e.target.value)}
                                            disabled={assignStatus === 'assigning'}
                                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div className="form-control" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Contact Number</label>
                                    <div className="input-wrapper" style={{ position: 'relative' }}>
                                        <i className='bx bx-phone input-icon' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}></i>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0771234567"
                                            required
                                            value={regPhone}
                                            onChange={(e) => setRegPhone(e.target.value)}
                                            disabled={assignStatus === 'assigning'}
                                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                                <div className="form-control" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Staff Role</label>
                                    <div className="input-wrapper" style={{ position: 'relative' }}>
                                        <i className='bx bx-briefcase input-icon' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 10 }}></i>
                                        <select
                                            value={regRole}
                                            onChange={(e) => setRegRole(e.target.value)}
                                            disabled={assignStatus === 'assigning'}
                                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                                        >
                                            <option value="staff">Staff</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <i className='bx bx-chevron-down' style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none', zIndex: 10 }}></i>
                                    </div>
                                </div>
                                <div className="form-control" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Branch</label>
                                    <div className="input-wrapper" style={{ position: 'relative' }}>
                                        <i className='bx bx-buildings input-icon' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 10 }}></i>
                                        <select
                                            value={regBranchId}
                                            onChange={(e) => setRegBranchId(e.target.value)}
                                            disabled={assignStatus === 'assigning'}
                                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', background: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                                        >
                                            {branches.map((b) => (
                                                <option key={b.branch_id} value={b.branch_id}>{b.branch_location}</option>
                                            ))}
                                        </select>
                                        <i className='bx bx-chevron-down' style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none', zIndex: 10 }}></i>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={assignStatus === 'assigning'}
                                    style={{ width: 'auto', height: '46px', padding: '0 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    {assignStatus === 'assigning' ? (
                                        <><i className='bx bx-loader-alt bx-spin'></i> Generating Credentials...</>
                                    ) : (
                                        <>Register & Assign Staff <i className='bx bx-right-arrow-alt'></i></>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAssignForm(false);
                                        setRegisteredCredentials(null);
                                    }}
                                    className="secondary-btn"
                                    style={{ width: 'auto', height: '46px', padding: '0 1.5rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Assigned Staff List */}
            {assignedStaff.length > 0 && (
                <div className="action-card" style={{ marginBottom: '2rem', padding: '2rem', border: '1px solid var(--card-border)', maxWidth: '100%', width: '100%', animation: 'fadeIn 0.5s ease' }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-group' style={{ color: 'var(--accent-color)' }}></i> Assigned Staff Members
                        </h3>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.8rem', borderRadius: '100px', fontSize: '0.85rem' }}>{assignedStaff.length} Total</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {assignedStaff.map((staff, index) => (
                            <div
                                key={index}
                                className="delivery-item"
                                onClick={() => handleStaffClick(staff)}
                                style={{
                                    padding: '1rem 1.25rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--card-border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer',
                                    boxShadow: '0 0 0 rgba(249, 115, 22, 0)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(249, 115, 22, 0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(238, 234, 231, 0.45)';
                                    e.currentTarget.style.boxShadow = '0 0 18px rgba(249, 115, 22, 0.22)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                    e.currentTarget.style.borderColor = 'var(--card-border)';
                                    e.currentTarget.style.boxShadow = '0 0 0 rgba(249, 115, 22, 0)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
        >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className='bx bx-user'></i>
                                    </div>
                                    <div>
                                        <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.2rem' }}>{staff}</p>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Staff Role</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveStaff && onRemoveStaff(staff);
                                    }}
                                    style={{ 
                                        background: 'rgba(239, 68, 68, 0.1)', 
                                        color: '#ef4444', 
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                    title="Remove Staff"
                                >
                                    <i className='bx bx-trash' style={{ fontSize: '1.2rem' }}></i>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {staffDetailsLoading && (
                <div
                    className="action-card"
                    style={{
                        marginBottom: '2rem',
                        padding: '1.5rem',
                        border: '1px solid var(--card-border)',
                        maxWidth: '100%',
                        width: '100%',
                    }}
                >
                    <p style={{ color: 'var(--text-secondary)' }}>
                        <i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i>
                        Loading staff details...
                    </p>
                </div>
            )}

            {selectedStaff && (
                <div
                    className="action-card"
                    style={{
                        marginBottom: '2rem',
                        padding: '2rem',
                        border: '1px solid var(--card-border)',
                        maxWidth: '100%',
                        width: '100%',
                        animation: 'fadeIn 0.3s ease',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem',
                            marginBottom: '1.5rem',
                        }}
                    >
                        <div>
                            <h3
                                style={{
                                    color: '#fff',
                                    fontSize: '1.3rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '0.4rem',
                                }}
                            >
                                <i className="bx bx-id-card" style={{ color: 'var(--accent-color)' }}></i>
                                Staff Details
                            </h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Details for {selectedStaff.staff_email}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSelectedStaff(null)}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--card-border)',
                                color: '#fff',
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            title="Close details"
                        >
                            <i className="bx bx-x" style={{ fontSize: '1.3rem' }}></i>
                        </button>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '1rem',
                        }}
                    >
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Name</p>
                            <h4 style={{ color: '#fff' }}>{selectedStaff.staff_name || 'N/A'}</h4>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Email</p>
                            <h4 style={{ color: '#fff' }}>{selectedStaff.staff_email || 'N/A'}</h4>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Phone</p>
                            <h4 style={{ color: '#fff' }}>{selectedStaff.staff_phone || 'N/A'}</h4>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Role</p>
                            <h4 style={{ color: '#fff' }}>{selectedStaff.staff_role || 'N/A'}</h4>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Branch ID</p>
                            <h4 style={{ color: '#fff' }}>{selectedStaff.branch_id || selectedStaff.branch_ID || 'N/A'}</h4>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Status</p>
                            <h4 style={{ color: selectedStaff.staff_active_status ? 'var(--success)' : 'var(--danger)' }}>
                                {selectedStaff.staff_active_status ? 'Active' : 'Inactive'}
                            </h4>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {stats.map((stat, index) => (
                    <div key={stat.id} className="stat-card" onClick={() => setSelectedStat(stat.id)} style={{
                        padding: '1.5rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '16px',
                        border: '1px solid var(--card-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        animation: `slideInRight 0.8s ease backwards ${(index + 1) * 0.2}s`
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'var(--card-border)';
                        }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: `rgba(${stat.color === 'var(--success)' ? '16, 185, 129' : stat.color === 'var(--accent-color)' ? '59, 130, 246' : '245, 158, 11'}, 0.1)`,
                            color: stat.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>
                            <i className={`bx ${stat.icon}`}></i>
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{stat.title}</p>
                            <h3 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: '700' }}>{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {selectedStat && (
            <div
                className="action-card"
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    padding: '2rem',
                    marginBottom: '2rem',
                    animation: 'fadeIn 0.3s ease',
                    border: '1px solid var(--card-border)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                        marginBottom: '1.5rem',
                    }}
                >
                    <div>
                        <h3
                            style={{
                                color: '#fff',
                                fontSize: '1.35rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.4rem',
                            }}
                        >
                            <i
                                className={`bx ${statDetails[selectedStat].icon}`}
                                style={{ color: 'var(--accent-color)' }}
                            ></i>
                            {statDetails[selectedStat].title}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            {statDetails[selectedStat].description}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setSelectedStat(null)}
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--card-border)',
                            color: '#fff',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        title="Close details"
                    >
                        <i className="bx bx-x" style={{ fontSize: '1.3rem' }}></i>
                    </button>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {statDetails[selectedStat].rows.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '12px',
                                border: '1px solid var(--card-border)',
                            }}
                        >
                            <p
                                style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.85rem',
                                    marginBottom: '0.4rem',
                                }}
                            >
                                {item.label}
                            </p>
                            <h4 style={{ color: '#fff', fontSize: '1.4rem' }}>
                                {item.value}
                            </h4>
                        </div>
                    ))}
                </div>
            </div>
        )}

            {/* Main content grid */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInUp 1s ease backwards 0.8s', margin: 0 }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-list-ul' style={{ color: 'var(--accent-color)' }}></i> Recent System Activity
                        </h3>
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.9rem' }}>View All</button>
                    </div>
                    
                    <div className="deliveries-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {recentOrders.map((order, index) => (
                            <div key={index} className="delivery-item" style={{ 
                                padding: '1.25rem', 
                                background: 'rgba(255, 255, 255, 0.03)', 
                                borderRadius: '16px',
                                border: '1px solid var(--card-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.borderColor = 'var(--card-border)';
                            }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                        <i className='bx bx-user'></i>
                                    </div>
                                    <div>
                                        <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.2rem', fontSize: '1.05rem' }}>{order.customer} <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>({order.id})</span></h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            <i className='bx bx-map' style={{ color: 'var(--accent-color)', marginRight: '4px' }}></i>
                                            {order.destination}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ 
                                        display: 'inline-block',
                                        padding: '0.35rem 0.85rem',
                                        background: order.status === 'Delivered' ? 'rgba(16, 185, 129, 0.1)' : order.status === 'In Transit' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        color: order.status === 'Delivered' ? 'var(--success)' : order.status === 'In Transit' ? 'var(--accent-color)' : '#f59e0b',
                                        borderRadius: '100px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        border: order.status === 'Delivered' ? '1px solid rgba(16, 185, 129, 0.2)' : order.status === 'In Transit' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                                    }}>
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            </>
            )}

            {activeTab === 'rides' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', animation: 'fadeIn 0.4s ease' }}>
                    
                    {/* Rider Management Card */}
                    <div className="action-card" style={{ padding: '2rem', border: '1px solid var(--card-border)', width: '100%', margin: 0 }}>
                        <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', margin: 0 }}>
                                    <i className='bx bx-run' style={{ color: 'var(--accent-color)' }}></i> Rider Availability Management
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>View and update the real-time status of your courier riders.</p>
                            </div>
                            <button onClick={loadRiders} className="secondary-btn" style={{ padding: '0.5rem 1rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}>
                                <i className='bx bx-refresh'></i> Refresh Riders
                            </button>
                        </div>

                        {loadingRiders ? (
                            <p style={{ color: 'var(--text-secondary)' }}><i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i> Loading riders...</p>
                        ) : ridersList.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)' }}>No riders registered in the system. Use the "Assign Staff" button above to register riders with the "Staff" role.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                {ridersList.map((rider) => {
                                    const statusColors = {
                                        'Available': { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' },
                                        'Busy': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' },
                                        'On Break': { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }
                                    };
                                    const statusStyle = statusColors[rider.availability_status || 'Available'] || statusColors['Available'];

                                    return (
                                        <div key={rider.staff_id} style={{
                                            padding: '1.25rem',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            borderRadius: '16px',
                                            border: '1px solid var(--card-border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1rem',
                                            transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                    {rider.staff_name ? rider.staff_name.charAt(0).toUpperCase() : 'R'}
                                                </div>
                                                <div style={{ textAlign: 'left' }}>
                                                    <h4 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>{rider.staff_name}</h4>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.1rem 0 0 0' }}>{rider.staff_email}</p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.25rem 0.65rem',
                                                    background: statusStyle.bg,
                                                    color: statusStyle.text,
                                                    borderRadius: '100px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    border: statusStyle.border
                                                }}>
                                                    {rider.availability_status || 'Available'}
                                                </span>

                                                <div className="input-wrapper" style={{ position: 'relative', width: '130px', margin: 0 }}>
                                                    <select
                                                        value={rider.availability_status || 'Available'}
                                                        onChange={(e) => handleUpdateRiderStatus(rider.staff_id, e.target.value)}
                                                        style={{ width: '100%', padding: '0.4rem 1.8rem 0.4rem 0.75rem', background: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                                                    >
                                                        <option value="Available">Available</option>
                                                        <option value="Busy">Busy</option>
                                                        <option value="On Break">On Break</option>
                                                    </select>
                                                    <i className='bx bx-chevron-down' style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}></i>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Ride Assignment Card */}
                    <div className="action-card" style={{ padding: '2rem', border: '1px solid var(--card-border)', width: '100%', margin: 0 }}>
                        <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', margin: 0 }}>
                                    <i className='bx bx-map-pin' style={{ color: 'var(--accent-color)' }}></i> Ride Assignment Panel
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Assign travel requests and courier requests to riders.</p>
                            </div>
                            <button onClick={loadAtrRequests} className="secondary-btn" style={{ padding: '0.5rem 1rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--card-border)' }}>
                                <i className='bx bx-refresh'></i> Refresh Rides
                            </button>
                        </div>

                        {loadingAtr ? (
                            <p style={{ color: 'var(--text-secondary)' }}><i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i> Loading rides...</p>
                        ) : atrRequests.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)' }}>No ride requests found in the system.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {atrRequests.map((req) => {
                                    const assignedRider = ridersList.find(r => r.staff_id === req.rider_id);
                                    
                                    return (
                                        <div key={req.atr_id} style={{
                                            padding: '1.5rem',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            borderRadius: '16px',
                                            border: '1px solid var(--card-border)',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '1.5rem',
                                            transition: 'all 0.3s ease',
                                            textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                                        >
                                            <div style={{ flex: '1 1 300px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>{req.atr_number}</span>
                                                    <span style={{
                                                        display: 'inline-block', padding: '0.25rem 0.65rem',
                                                        background: req.status === 'Approved' || req.status === 'Completed' ? 'rgba(16,185,129,0.1)' : req.status === 'Pending' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: req.status === 'Approved' || req.status === 'Completed' ? 'var(--success)' : req.status === 'Pending' ? '#f59e0b' : 'var(--danger)',
                                                        borderRadius: '100px', fontSize: '0.75rem', fontWeight: '600',
                                                        border: req.status === 'Approved' || req.status === 'Completed' ? '1px solid rgba(16,185,129,0.2)' : req.status === 'Pending' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(239,68,68,0.2)'
                                                    }}>{req.status}</span>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    <div><strong>Passenger:</strong> {req.principal_passenger_name} ({req.principal_passenger_designation})</div>
                                                    <div><strong>Vehicle Type:</strong> {req.vehicle_type}</div>
                                                    <div><strong>Required Date:</strong> {req.required_date} @ {req.required_time}</div>
                                                    <div><strong>Est. Cost:</strong> {req.estimated_cost} LKR</div>
                                                </div>
                                            </div>

                                            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                                {assignedRider ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
                                                        <div style={{ textAlign: 'left' }}>
                                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>Assigned Rider</p>
                                                            <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>{assignedRider.staff_name}</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleAssignRider(req.atr_id, null)}
                                                            className="secondary-btn" 
                                                            style={{ padding: '0.35rem 0.6rem', height: 'auto', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', borderRadius: '8px' }}
                                                        >
                                                            Unassign
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div className="input-wrapper" style={{ position: 'relative', width: '220px', margin: 0 }}>
                                                            <select
                                                                id={`select-rider-${req.atr_id}`}
                                                                defaultValue=""
                                                                style={{ width: '100%', padding: '0.6rem 2rem 0.6rem 0.85rem', background: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                                                            >
                                                                <option value="" disabled>Select a Rider...</option>
                                                                {ridersList.map(r => (
                                                                    <option key={r.staff_id} value={r.staff_id}>
                                                                        {r.staff_name} ({r.availability_status})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <i className='bx bx-chevron-down' style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}></i>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const sel = document.getElementById(`select-rider-${req.atr_id}`);
                                                                if (sel && sel.value) {
                                                                    handleAssignRider(req.atr_id, sel.value);
                                                                } else {
                                                                    alert('Please select a rider first.');
                                                                }
                                                            }}
                                                            className="primary-btn"
                                                            style={{ width: 'auto', padding: '0.6rem 1.25rem', height: '38px', fontSize: '0.85rem', background: 'var(--accent-color)' }}
                                                        >
                                                            Assign
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
