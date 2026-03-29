import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const AdminDashboard = ({ assignedStaff = [], onAssignStaff, onRemoveStaff }) => {
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [staffEmail, setStaffEmail] = useState('');
    const [assignStatus, setAssignStatus] = useState('');

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

    const handleAssignStaff = async (e) => {
        e.preventDefault();
        if (!staffEmail) return;

        setAssignStatus('assigning');

        try {
            // Check if already a staff member
            const { data: existingStaff } = await supabase
                .from('staff')
                .select('staff_id')
                .eq('staff_email', staffEmail)
                .single();

            if (existingStaff) {
                alert('Staff member already assigned');
                setAssignStatus('');
                return;
            }

            // Check if user is a registered customer
            const { data: customer } = await supabase
                .from('customer')
                .select('*')
                .eq('cust_email', staffEmail)
                .single();

            if (!customer) {
                alert('User is not registered. Cannot assign as staff.');
                setAssignStatus('');
                return;
            }

            // Ensure a branch exists
            let { data: branches } = await supabase
                .from('branch')
                .select('branch_id')
                .limit(1);

            let branchId = 1;
            if (!branches || branches.length === 0) {
                const { data: newBranch } = await supabase
                    .from('branch')
                    .insert({ branch_location: 'Main Office' })
                    .select('branch_id')
                    .single();
                branchId = newBranch.branch_id;
            } else {
                branchId = branches[0].branch_id;
            }

            // Insert staff
            const { error } = await supabase.from('staff').insert({
                staff_name: customer.cust_name || 'New Staff',
                staff_email: staffEmail,
                staff_phone: customer.cust_phoneno || '555-0000',
                branch_id: branchId,
                staff_role: 'staff',
                staff_active_status: true,
                staff_password: customer.cust_password,
            });

            if (error) throw error;

            setAssignStatus('success');
            if (onAssignStaff) onAssignStaff(staffEmail);
            setTimeout(() => {
                setShowAssignForm(false);
                setStaffEmail('');
                setAssignStatus('');
            }, 1500);
        } catch (err) {
            console.error('Assign staff error:', err);
            alert('Failed to assign staff. Please try again.');
            setAssignStatus('');
        }
    };
    // Sample dummy data for admin view
    const stats = [
        { title: 'Total Deliveries', value: '1,284', icon: 'bx-package', color: 'var(--success)' },
        { title: 'Active Couriers', value: '42', icon: 'bx-run', color: 'var(--accent-color)' },
        { title: 'Pending Routes', value: '15', icon: 'bx-map-alt', color: '#f59e0b' },
    ];

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
                    <button className="primary-btn pulse-effect" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f59e0b', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', height: '44px' }}>
                        <i className='bx bx-printer'></i> Generate Report
                    </button>
                </div>
            </div>

            {/* Assign Staff Form (conditional) */}
            {showAssignForm && (
                <div className="action-card" style={{ marginBottom: '2rem', animation: 'slideInDown 0.4s ease', padding: '2rem', border: '1px solid var(--card-border)', maxWidth: '100%', width: '100%' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', textAlign: 'left' }}>
                        <i className='bx bx-user-check' style={{ color: 'var(--accent-color)' }}></i> Assign New Staff Member
                    </h3>
                    <form onSubmit={handleAssignStaff} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-control" style={{ flex: 1, minWidth: '250px', marginBottom: 0, textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Staff Email Address</label>
                            <div className="input-wrapper" style={{ position: 'relative' }}>
                                <i className='bx bx-envelope input-icon' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}></i>
                                <input
                                    type="email"
                                    placeholder="e.g. staff@sccourier.com"
                                    required
                                    value={staffEmail}
                                    onChange={(e) => setStaffEmail(e.target.value)}
                                    disabled={assignStatus === 'assigning' || assignStatus === 'success'}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.8rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '1rem',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            className="primary-btn" 
                            disabled={assignStatus === 'assigning' || assignStatus === 'success'}
                            style={{ 
                                width: 'auto', 
                                height: '46px',
                                padding: '0 1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                ...(assignStatus === 'success' ? { background: 'var(--success)', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)' } : {}) 
                            }}
                        >
                            {assignStatus === 'assigning' ? (
                                <><i className='bx bx-loader-alt bx-spin'></i> Assigning...</>
                            ) : assignStatus === 'success' ? (
                                <><i className='bx bx-check'></i> Staff Assigned</>
                            ) : (
                                <>Assign Staff <i className='bx bx-right-arrow-alt'></i></>
                            )}
                        </button>
                    </form>
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
                            <div key={index} className="delivery-item" style={{
                                padding: '1rem 1.25rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '12px',
                                border: '1px solid var(--card-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                            }}>
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
                                    onClick={() => onRemoveStaff && onRemoveStaff(staff)}
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

            {/* Stats Grid */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {stats.map((stat, index) => (
                    <div key={index} className="stat-card" style={{
                        padding: '1.5rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '16px',
                        border: '1px solid var(--card-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        animation: `slideInRight 0.8s ease backwards ${(index + 1) * 0.2}s`
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
        </div>
    );
};

export default AdminDashboard;
