import React from 'react';

const CustomerDashboard = ({ onDeliver }) => {
    const previousDeliveries = [
        { id: 'SC100892', date: '2023-10-15', status: 'Delivered', destination: 'Los Angeles, CA' },
        { id: 'SC100865', date: '2023-10-10', status: 'Delivered', destination: 'Chicago, IL' },
        { id: 'SC100810', date: '2023-09-28', status: 'Delivered', destination: 'Miami, FL' },
    ];

    const activePackages = [
        { id: 'SC101000', ordered: '2024-02-25', destination: 'Seattle, WA', status: 'Approved' },
        { id: 'SC101015', ordered: '2024-03-02', destination: 'Denver, CO', status: 'Declined on delivery' },
    ];

    // departments data removed as it's no longer displayed


    return (
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
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                            }}>
                                <div>
                                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{pkg.id}</h4>
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
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
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
                                <div>
                                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{delivery.id}</h4>
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
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDashboard;
