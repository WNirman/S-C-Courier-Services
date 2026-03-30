import React, { useState } from 'react';
import dashboardBg from './assets/dashboard-bg.png';

const CustomerDashboard = ({ onDeliver }) => {
    const [expandedPackage, setExpandedPackage] = useState(null);

    const toggleExpand = (id) => {
        if (expandedPackage === id) setExpandedPackage(null);
        else setExpandedPackage(id);
    };

    const previousDeliveries = [
        { 
            id: 'SC100892', 
            date: '2023-10-15', 
            ordered: '2023-10-10',
            status: 'Delivered', 
            destination: 'Los Angeles, CA',
            timeline: [
                { status: 'Order Placed', time: '09:00 AM, Oct 10', completed: true },
                { status: 'Approved', time: '10:30 AM, Oct 10', completed: true },
                { status: 'Handed over to courier', time: '08:00 AM, Oct 12', completed: true },
                { status: 'Out for delivery', time: '07:30 AM, Oct 15', completed: true },
                { status: 'Delivered', time: '02:00 PM, Oct 15', completed: true }
            ]
        },
        { 
            id: 'SC100865', 
            date: '2023-10-10', 
            ordered: '2023-10-05',
            status: 'Delivered', 
            destination: 'Chicago, IL',
            timeline: [
                { status: 'Order Placed', time: '02:15 PM, Oct 05', completed: true },
                { status: 'Approved', time: '03:00 PM, Oct 05', completed: true },
                { status: 'Handed over to courier', time: '09:30 AM, Oct 08', completed: true },
                { status: 'Out for delivery', time: '08:00 AM, Oct 10', completed: true },
                { status: 'Delivered', time: '04:45 PM, Oct 10', completed: true }
            ]
        },
        { 
            id: 'SC100810', 
            date: '2023-09-28', 
            ordered: '2023-09-20',
            status: 'Delivered', 
            destination: 'Miami, FL',
            timeline: [
                { status: 'Order Placed', time: '11:00 AM, Sep 20', completed: true },
                { status: 'Approved', time: '11:45 AM, Sep 20', completed: true },
                { status: 'Handed over to courier', time: '10:00 AM, Sep 22', completed: true },
                { status: 'Out for delivery', time: '09:15 AM, Sep 28', completed: true },
                { status: 'Delivered', time: '01:30 PM, Sep 28', completed: true }
            ]
        },
    ];

    const activePackages = [
        { 
            id: 'SC101000', 
            ordered: '2024-02-25', 
            destination: 'Seattle, WA', 
            status: 'Approved',
            timeline: [
                { status: 'Order Placed', time: '09:00 AM, Feb 25', completed: true },
                { status: 'Approved', time: '10:30 AM, Feb 25', completed: true },
                { status: 'Handed over to courier', time: 'Pending', completed: false },
                { status: 'Delivered', time: 'Pending', completed: false }
            ]
        },
        { 
            id: 'SC101015', 
            ordered: '2024-03-02', 
            destination: 'Denver, CO', 
            status: 'Declined on delivery',
            reason: 'Customer was not available at the location or provided wrong address details.',
            timeline: [
                { status: 'Order Placed', time: '08:15 AM, Mar 02', completed: true },
                { status: 'Approved', time: '09:00 AM, Mar 02', completed: true },
                { status: 'Handed over to courier', time: '11:30 AM, Mar 02', completed: true },
                { status: 'Out for delivery', time: '08:00 AM, Mar 03', completed: true },
                { status: 'Declined on delivery', time: '02:45 PM, Mar 03', completed: true, isError: true }
            ]
        },
    ];

    // departments data removed as it's no longer displayed


    return (
        <>
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundImage: `linear-gradient(rgba(5, 5, 5, 0.75), rgba(5, 5, 5, 0.9)), url(${dashboardBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: -1,
                animation: 'fadeIn 1.5s ease'
            }} />
            <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease', padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', zIndex: 10 }}>
                {/* Header with action button */}
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                            <i className='bx bx-tachometer'></i> Customer Dashboard
                        </h2>
                        <p style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>Overview of your account and shipments</p>
                    </div>
                    <button className="primary-btn" onClick={onDeliver} style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className='bx bx-truck'></i> Deliver Now
                    </button>
                </div>

                {/* Main content grid */}
                <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                    {/* Active Packages Section */}
                    <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInRight 1s ease backwards 0.4s', margin: 0 }}>
                        <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                                <i className='bx bx-package' style={{ color: 'var(--accent-color)' }}></i> Active Packages
                            </h3>
                        </div>
                        <div className="deliveries-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {activePackages.map((pkg, index) => (
                                <div key={index} className="delivery-item" style={{
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--card-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer'
                                }} onClick={() => toggleExpand(pkg.id)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div>
                                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {pkg.id}
                                                <i className={`bx bx-chevron-${expandedPackage === pkg.id ? 'up' : 'down'}`} style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', transition: 'transform 0.3s ease' }}></i>
                                            </h4>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                <i className='bx bx-map' style={{ color: 'var(--accent-color)', marginRight: '4px' }}></i>
                                                {pkg.destination}
                                            </p>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}><strong>Ordered:</strong> {pkg.ordered}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.35rem 0.85rem',
                                                background: pkg.status === 'Approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: pkg.status === 'Approved' ? 'var(--success)' : 'var(--danger)',
                                                borderRadius: '100px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                marginBottom: '0.5rem',
                                                border: pkg.status === 'Approved' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                            }}>
                                                {pkg.status}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Expanded Timeline Section */}
                                    {expandedPackage === pkg.id && (
                                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--card-border)', animation: 'fadeIn 0.3s ease' }}>
                                            {pkg.reason && (
                                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', borderRadius: '4px' }}>
                                                    <p style={{ color: 'var(--danger)', fontSize: '0.9rem', margin: 0 }}><strong>Reason:</strong> {pkg.reason}</p>
                                                </div>
                                            )}
                                            <h5 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Tracking Timeline</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                                                {/* Vertical line for timeline */}
                                                <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
                                                
                                                {pkg.timeline.map((step, stepIdx) => (
                                                    <div key={stepIdx} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1 }}>
                                                        <div style={{ 
                                                            width: '24px', height: '24px', 
                                                            borderRadius: '50%', 
                                                            background: step.isError ? 'var(--danger)' : (step.completed ? 'var(--success)' : '#222'),
                                                            border: `2px solid ${step.isError ? 'rgba(239, 68, 68, 0.3)' : (step.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--text-secondary)')}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {step.completed && !step.isError && <i className='bx bx-check' style={{ color: '#000', fontSize: '1rem', fontWeight: 'bold' }}></i>}
                                                            {step.isError && <i className='bx bx-x' style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}></i>}
                                                        </div>
                                                        <div style={{ flex: 1, paddingTop: '2px' }}>
                                                            <p style={{ color: step.isError ? 'var(--danger)' : (step.completed ? 'var(--text-primary)' : 'var(--text-secondary)'), fontWeight: step.completed ? '600' : '400', fontSize: '0.95rem', margin: '0 0 0.25rem 0' }}>{step.status}</p>
                                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{step.time}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Previous Deliveries Section */}
                    <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInRight 1s ease backwards 0.2s', margin: 0 }}>
                        <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                                <i className='bx bx-history' style={{ color: 'var(--accent-color)' }}></i> Previous Deliveries
                            </h3>
                        </div>
                        <div className="deliveries-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {previousDeliveries.map((delivery, index) => (
                                <div key={index} className="delivery-item" style={{
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--card-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer'
                                }}
                                    onClick={() => toggleExpand(delivery.id)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                        e.currentTarget.style.borderColor = 'var(--card-border)';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div>
                                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {delivery.id}
                                                <i className={`bx bx-chevron-${expandedPackage === delivery.id ? 'up' : 'down'}`} style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', transition: 'transform 0.3s ease' }}></i>
                                            </h4>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                <i className='bx bx-map' style={{ color: 'var(--accent-color)', marginRight: '4px' }}></i>
                                                {delivery.destination}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.35rem 0.85rem',
                                                background: 'rgba(16, 185, 129, 0.1)',
                                                color: 'var(--success)',
                                                borderRadius: '100px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                marginBottom: '0.5rem',
                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                            }}>
                                                <i className='bx bx-check-circle' style={{ marginRight: '4px' }}></i>
                                                {delivery.status}
                                            </span>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{delivery.date}</p>
                                        </div>
                                    </div>
                                    {/* Expanded Timeline Section */}
                                    {expandedPackage === delivery.id && (
                                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--card-border)', animation: 'fadeIn 0.3s ease' }}>
                                            {delivery.reason && (
                                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', borderRadius: '4px' }}>
                                                    <p style={{ color: 'var(--danger)', fontSize: '0.9rem', margin: 0 }}><strong>Reason:</strong> {delivery.reason}</p>
                                                </div>
                                            )}
                                            <h5 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Tracking Timeline</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                                                {/* Vertical line for timeline */}
                                                <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
                                                
                                                {delivery.timeline.map((step, stepIdx) => (
                                                    <div key={stepIdx} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1 }}>
                                                        <div style={{ 
                                                            width: '24px', height: '24px', 
                                                            borderRadius: '50%', 
                                                            background: step.isError ? 'var(--danger)' : (step.completed ? 'var(--success)' : '#222'),
                                                            border: `2px solid ${step.isError ? 'rgba(239, 68, 68, 0.3)' : (step.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--text-secondary)')}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {step.completed && !step.isError && <i className='bx bx-check' style={{ color: '#000', fontSize: '1rem', fontWeight: 'bold' }}></i>}
                                                            {step.isError && <i className='bx bx-x' style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}></i>}
                                                        </div>
                                                        <div style={{ flex: 1, paddingTop: '2px' }}>
                                                            <p style={{ color: step.isError ? 'var(--danger)' : (step.completed ? 'var(--text-primary)' : 'var(--text-secondary)'), fontWeight: step.completed ? '600' : '400', fontSize: '0.95rem', margin: '0 0 0.25rem 0' }}>{step.status}</p>
                                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{step.time}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CustomerDashboard;
