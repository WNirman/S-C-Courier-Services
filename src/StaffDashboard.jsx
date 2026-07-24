import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const StaffDashboard = ({ loggedInUser }) => {
    const [riderProfile, setRiderProfile] = useState(null);
    const [assignedRides, setAssignedRides] = useState([]);
    const [loading, setLoading] = useState(true);

    // Personal Deliveries State
    const [personalDeliveries, setPersonalDeliveries] = useState([]);
    const [loadingPD, setLoadingPD] = useState(false);
    const [acceptingPD, setAcceptingPD] = useState(null);

    const loadRiderData = async () => {
        if (!loggedInUser) return;
        setLoading(true);
        try {
            // 1. Fetch rider profile matching logged-in user email
            const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('staff_id, staff_name, staff_email, staff_phone, staff_active_status, availability_status')
                .eq('staff_email', loggedInUser)
                .single();

            if (staffError) throw staffError;
            setRiderProfile(staffData);

            if (staffData) {
                // 2. Fetch active and past ATR requests assigned to this rider
                const { data: atrData, error: atrError } = await supabase
                    .from('atr')
                    .select('*')
                    .eq('approved_by', staffData.staff_id)
                    .order('atr_id', { ascending: false });

                if (atrError) throw atrError;
                setAssignedRides(atrData || []);
            }
        } catch (err) {
            console.error('Error loading rider dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPersonalDeliveries = async () => {
        setLoadingPD(true);
        let fetchedData = [];
        try {
            const res = await fetch('http://localhost:5000/api/personal-deliveries');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) fetchedData = data;
            }
        } catch (err) {
            console.error('Error loading personal deliveries:', err);
        }
        const localData = JSON.parse(localStorage.getItem('local_personal_deliveries') || '[]');
        const combined = [...localData, ...fetchedData];
        const unique = Array.from(new Map(combined.map(item => [item.pd_id, item])).values());
        setPersonalDeliveries(unique);
        setLoadingPD(false);
    };

    const handleAcceptDelivery = async (pdId) => {
        setAcceptingPD(pdId);
        try {
            const acceptedByEmail = loggedInUser || 'staff@sccourier.com';

            // 1. Update status via Supabase (if table exists)
            try {
                await supabase
                    .from('personal_delivery')
                    .update({
                        status: 'Accepted',
                        accepted_by: acceptedByEmail,
                        accepted_at: new Date().toISOString()
                    })
                    .eq('pd_id', pdId);
            } catch (sbErr) {
                console.warn('Supabase status update note:', sbErr);
            }

            // 2. Update status in local storage fallback
            const localData = JSON.parse(localStorage.getItem('local_personal_deliveries') || '[]');
            const updatedLocal = localData.map(pd => pd.pd_id === pdId ? {
                ...pd,
                status: 'Accepted',
                accepted_by: acceptedByEmail,
                accepted_at: new Date().toISOString()
            } : pd);
            localStorage.setItem('local_personal_deliveries', JSON.stringify(updatedLocal));

            // 3. Try sending acceptance email via Express backend (if running)
            let emailMsg = '';
            try {
                const res = await fetch('http://localhost:5000/api/delivery/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pdId, acceptedBy: acceptedByEmail })
                });
                if (res.ok) {
                    const data = await res.json();
                    emailMsg = ' Scheduling email sent to customer.';
                    if (data.previewUrl) {
                        console.log('Ethereal Email Preview:', data.previewUrl);
                    }
                }
            } catch (err) {
                console.log('Backend notification server off — acceptance saved locally.');
            }

            alert('Delivery accepted successfully!' + emailMsg);
            loadPersonalDeliveries();
        } catch (err) {
            console.error('Error accepting delivery:', err);
            alert('Failed to accept delivery: ' + err.message);
        } finally {
            setAcceptingPD(null);
        }
    };

    const handleUpdateDeliveryStatus = async (pdId, newStatus) => {
        try {
            const { error } = await supabase
                .from('personal_delivery')
                .update({ status: newStatus })
                .eq('pd_id', pdId);
            if (error) throw error;
            alert(`Delivery status updated to ${newStatus}!`);
            loadPersonalDeliveries();
        } catch (err) {
            console.error('Error updating delivery status:', err);
            alert('Failed to update status: ' + err.message);
        }
    };

    useEffect(() => {
        loadRiderData();
        loadPersonalDeliveries();
    }, [loggedInUser]);

    const handleUpdateAvailability = async (newStatus) => {
        if (!riderProfile) return;
        try {
            const { error } = await supabase
                .from('staff')
                .update({ availability_status: newStatus })
                .eq('staff_id', riderProfile.staff_id);

            if (error) throw error;
            setRiderProfile(prev => ({ ...prev, availability_status: newStatus }));
            alert('Availability status updated to ' + newStatus);
        } catch (err) {
            console.error('Error updating availability:', err);
            alert('Failed to update availability: ' + err.message);
        }
    };

    const handleUpdateRideStatus = async (atrId, newStatus) => {
        try {
            // Update ATR request status
            const { error } = await supabase
                .from('atr')
                .update({ status: newStatus })
                .eq('atr_id', atrId);

            if (error) throw error;

            // If ride is completed, automatically mark rider as Available
            if (newStatus === 'Completed' && riderProfile) {
                await supabase
                    .from('staff')
                    .update({ availability_status: 'Available' })
                    .eq('staff_id', riderProfile.staff_id);
                setRiderProfile(prev => ({ ...prev, availability_status: 'Available' }));
            }

            alert('Ride status updated successfully!');
            // Reload assigned rides
            loadRiderData();
        } catch (err) {
            console.error('Error updating ride status:', err);
            alert('Failed to update ride status: ' + err.message);
        }
    };

    // Derived stats
    const totalDeliveries = assignedRides.filter(r => r.status === 'Completed').length;
    const pendingDeliveries = assignedRides.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Rejected').length;
    const currentAvailability = riderProfile ? riderProfile.availability_status : 'Available';
    const pendingPD = personalDeliveries.filter(pd => pd.status === 'Pending').length;

    const stats = [
        { title: 'Total Completed', value: totalDeliveries.toString(), icon: 'bx-check-double', color: 'var(--success)' },
        { title: 'Pending Rides', value: pendingDeliveries.toString(), icon: 'bx-navigation', color: '#f59e0b' },
        { title: 'My Availability', value: currentAvailability, icon: 'bx-run', color: 'var(--accent-color)' },
        { title: 'Pending Deliveries', value: pendingPD.toString(), icon: 'bx-package', color: '#a855f7' },
    ];

    return (
        <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease', padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', zIndex: 10 }}>
            
            {/* Header */}
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ textAlign: 'left' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                        <i className='bx bx-id-card'></i> Rider Dashboard
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Welcome back, <strong style={{ color: '#fff' }}>{riderProfile ? riderProfile.staff_name : 'Rider'}</strong>
                    </p>
                </div>

                {riderProfile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>Availability Status</p>
                            <strong style={{ 
                                color: riderProfile.availability_status === 'Available' ? 'var(--success)' : 
                                       riderProfile.availability_status === 'Busy' ? '#f59e0b' : 'var(--danger)',
                                fontSize: '0.95rem'
                            }}>
                                {riderProfile.availability_status || 'Available'}
                            </strong>
                        </div>
                        <div className="input-wrapper" style={{ position: 'relative', width: '130px', margin: 0 }}>
                            <select
                                value={riderProfile.availability_status || 'Available'}
                                onChange={(e) => handleUpdateAvailability(e.target.value)}
                                style={{ width: '100%', padding: '0.4rem 1.8rem 0.4rem 0.75rem', background: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                            >
                                <option value="Available">Available</option>
                                <option value="Busy">Busy</option>
                                <option value="On Break">On Break</option>
                            </select>
                            <i className='bx bx-chevron-down' style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}></i>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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
                            background: `rgba(${stat.color === 'var(--success)' ? '16, 185, 129' : stat.color === 'var(--accent-color)' ? '59, 130, 246' : stat.color === '#a855f7' ? '168, 85, 247' : '245, 158, 11'}, 0.1)`,
                            color: stat.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>
                            <i className={`bx ${stat.icon}`}></i>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{stat.title}</p>
                            <h3 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: '700' }}>{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main content grid */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                
                {/* Assigned Rides Section */}
                <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInUp 1s ease backwards 0.8s', margin: 0 }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-navigation' style={{ color: 'var(--accent-color)' }}></i> My Assigned Rides & Deliveries
                        </h3>
                        <button onClick={loadRiderData} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <i className='bx bx-refresh'></i> Refresh
                        </button>
                    </div>

                    {loading ? (
                        <p style={{ color: 'var(--text-secondary)' }}><i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i> Loading assignments...</p>
                    ) : assignedRides.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>No ride or delivery assignments found at this moment.</p>
                    ) : (
                        <div className="deliveries-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {assignedRides.map((ride, index) => {
                                const statusColors = {
                                    'Approved': 'rgba(59, 130, 246, 0.1)',
                                    'In Transit': 'rgba(245, 158, 11, 0.1)',
                                    'Completed': 'rgba(16, 185, 129, 0.1)',
                                    'Cancelled': 'rgba(239, 68, 68, 0.1)'
                                };
                                const textColors = {
                                    'Approved': 'var(--accent-color)',
                                    'In Transit': '#f59e0b',
                                    'Completed': 'var(--success)',
                                    'Cancelled': 'var(--danger)'
                                };
                                
                                return (
                                    <div key={ride.atr_id || index} className="delivery-item" style={{ 
                                        padding: '1.5rem', 
                                        background: 'rgba(255, 255, 255, 0.02)', 
                                        borderRadius: '16px',
                                        border: '1px solid var(--card-border)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.3s ease',
                                        gap: '1.5rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                        e.currentTarget.style.borderColor = 'var(--card-border)';
                                    }}
                                    >
                                        <div style={{ flex: '1 1 300px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem' }}>{ride.atr_number}</h4>
                                                <span style={{ 
                                                    display: 'inline-block',
                                                    padding: '0.25rem 0.65rem',
                                                    background: statusColors[ride.status] || 'rgba(255,255,255,0.05)',
                                                    color: textColors[ride.status] || '#fff',
                                                    borderRadius: '100px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    border: `1px solid ${textColors[ride.status] || '#fff'}22`
                                                }}>
                                                    {ride.status}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                <div><strong>Passenger:</strong> {ride.principal_passenger_name} ({ride.principal_passenger_designation})</div>
                                                <div><strong>Vehicle Type:</strong> {ride.vehicle_type}</div>
                                                <div><strong>Required Time:</strong> {ride.required_date} @ {ride.required_time}</div>
                                                <div><strong>Purpose:</strong> {ride.purpose_of_travel}</div>
                                                <div><strong>Est. Cost:</strong> {ride.estimated_cost} LKR</div>
                                            </div>
                                        </div>

                                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {ride.status === 'Approved' && (
                                                <button
                                                    onClick={() => handleUpdateRideStatus(ride.atr_id, 'In Transit')}
                                                    className="primary-btn pulse-effect"
                                                    style={{ width: 'auto', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '40px', padding: '0 1.25rem' }}
                                                >
                                                    <i className='bx bx-play'></i> Start Ride
                                                </button>
                                            )}
                                            {ride.status === 'In Transit' && (
                                                <button
                                                    onClick={() => handleUpdateRideStatus(ride.atr_id, 'Completed')}
                                                    className="primary-btn"
                                                    style={{ width: 'auto', background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '40px', padding: '0 1.25rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <i className='bx bx-check'></i> Complete Ride
                                                </button>
                                            )}
                                            {ride.status !== 'Completed' && ride.status !== 'Cancelled' && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to cancel this ride?')) {
                                                            handleUpdateRideStatus(ride.atr_id, 'Cancelled');
                                                        }
                                                    }}
                                                    className="secondary-btn"
                                                    style={{ width: 'auto', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', height: '40px', padding: '0 1rem' }}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Personal Deliveries Section */}
                <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInUp 1.2s ease backwards 1s', margin: 0 }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-package' style={{ color: '#a855f7' }}></i> Personal Delivery Requests
                        </h3>
                        <button onClick={loadPersonalDeliveries} style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <i className='bx bx-refresh'></i> Refresh
                        </button>
                    </div>

                    {loadingPD ? (
                        <p style={{ color: 'var(--text-secondary)' }}><i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i> Loading deliveries...</p>
                    ) : personalDeliveries.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>No personal delivery requests at this time.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {personalDeliveries.map((pd) => {
                                const statusColors = {
                                    'Pending': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' },
                                    'Accepted': { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' },
                                    'Scheduled': { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' },
                                    'Assigned': { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' },
                                    'In Transit': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' },
                                    'Completed': { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)' },
                                };
                                const sc = statusColors[pd.status] || statusColors['Pending'];

                                return (
                                    <div key={pd.pd_id} style={{
                                        padding: '1.5rem',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '16px',
                                        border: '1px solid var(--card-border)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.3s ease',
                                        gap: '1.5rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                                    >
                                        <div style={{ flex: '1 1 300px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>PD-{pd.pd_id}</h4>
                                                <span style={{
                                                    display: 'inline-block', padding: '0.25rem 0.65rem',
                                                    background: sc.bg, color: sc.text,
                                                    borderRadius: '100px', fontSize: '0.75rem', fontWeight: '600',
                                                    border: sc.border
                                                }}>{pd.status}</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                <div><strong>📍 Pickup:</strong> {pd.pickup_address}</div>
                                                <div><strong>📍 Drop:</strong> {pd.drop_address}</div>
                                                <div><strong>📦 Item:</strong> {pd.item_type}</div>
                                                <div><strong>👤 Receiver:</strong> {pd.receiver_name} ({pd.receiver_phone})</div>
                                                <div><strong>📅 Requested:</strong> {pd.requested_date} @ {pd.requested_time}</div>
                                                {pd.scheduled_date && (
                                                    <div style={{ color: '#a855f7' }}><strong>📅 Scheduled:</strong> {pd.scheduled_date} @ {pd.scheduled_time}</div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            {pd.status === 'Pending' && (
                                                <button
                                                    onClick={() => handleAcceptDelivery(pd.pd_id)}
                                                    disabled={acceptingPD === pd.pd_id}
                                                    className="primary-btn pulse-effect"
                                                    style={{
                                                        width: 'auto',
                                                        background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                                        height: '38px', padding: '0 1rem', fontSize: '0.85rem',
                                                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
                                                        opacity: acceptingPD === pd.pd_id ? 0.7 : 1
                                                    }}
                                                >
                                                    {acceptingPD === pd.pd_id ? (
                                                        <><i className='bx bx-loader-alt bx-spin'></i> Accepting...</>
                                                    ) : (
                                                        <><i className='bx bx-check-circle'></i> Accept</>
                                                    )}
                                                </button>
                                            )}
                                            {pd.status === 'Assigned' && (
                                                <button
                                                    onClick={() => handleUpdateDeliveryStatus(pd.pd_id, 'In Transit')}
                                                    className="primary-btn pulse-effect"
                                                    style={{ width: 'auto', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1rem', fontSize: '0.85rem' }}
                                                >
                                                    <i className='bx bx-play'></i> Start Delivery
                                                </button>
                                            )}
                                            {pd.status === 'In Transit' && (
                                                <button
                                                    onClick={() => handleUpdateDeliveryStatus(pd.pd_id, 'Completed')}
                                                    className="primary-btn"
                                                    style={{ width: 'auto', background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1rem', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <i className='bx bx-check'></i> Complete
                                                </button>
                                            )}
                                            {(pd.status === 'Assigned' || pd.status === 'In Transit') && (
                                                <a
                                                    href={`http://localhost:5000/api/delivery/${pd.pd_id}/map`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="secondary-btn"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                                        padding: '0.5rem 0.85rem', height: 'auto',
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                        color: '#3b82f6',
                                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                                        textDecoration: 'none', borderRadius: '10px',
                                                        fontSize: '0.85rem', fontWeight: '600'
                                                    }}
                                                >
                                                    <i className='bx bx-map'></i> Map
                                                </a>
                                            )}
                                            {pd.status === 'Completed' && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontSize: '0.85rem', fontWeight: '600' }}>
                                                    <i className='bx bx-check-double'></i> Delivered
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;
