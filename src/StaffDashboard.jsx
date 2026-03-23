import React from 'react';

const StaffDashboard = () => {
    // Sample dummy data
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
                        <i className='bx bx-id-card'></i> Staff Dashboard
                    </h2>
                    <p style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>Logistics overview and daily progress</p>
                </div>
            </div>

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

export default StaffDashboard;
