import React, { useState, useMemo, useRef } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function ReportAnalyticsView({
    staffData = [],
    riderData = [],
    atrData = [],
    courierData = [],
    customerData = [],
    invoiceData = [],
    paymentData = [],
    onExportCSV,
    onRefresh,
    isLoading = false
}) {
    const [timeFilter, setTimeFilter] = useState('all'); // 'all', '30days', '7days'
    const reportRef = useRef(null);

    // Filtered data based on time filter
    const filterByDate = (items, dateField = 'created_at') => {
        if (timeFilter === 'all') return items;
        const now = new Date();
        const days = timeFilter === '7days' ? 7 : 30;
        const cutoff = new Date(now.setDate(now.getDate() - days));
        return items.filter(item => {
            const dateVal = item[dateField] || item.issue_date || item.required_date;
            if (!dateVal) return true;
            return new Date(dateVal) >= cutoff;
        });
    };

    const filteredATR = useMemo(() => filterByDate(atrData, 'required_date'), [atrData, timeFilter]);
    const filteredCourier = useMemo(() => filterByDate(courierData, 'created_at'), [courierData, timeFilter]);
    const filteredInvoice = useMemo(() => filterByDate(invoiceData, 'issue_date'), [invoiceData, timeFilter]);
    const filteredPayment = useMemo(() => filterByDate(paymentData, 'payment_date'), [paymentData, timeFilter]);

    // Financial Metrics
    const totalInvoiced = useMemo(() => {
        return filteredInvoice.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    }, [filteredInvoice]);

    const totalPaid = useMemo(() => {
        return filteredPayment
            .filter(p => ['success', 'paid'].includes(String(p.status || '').toLowerCase()))
            .reduce((acc, p) => acc + Number(p.amount || 0), 0);
    }, [filteredPayment]);

    const totalEstATRCost = useMemo(() => {
        return filteredATR.reduce((acc, a) => acc + Number(a.estimated_cost || 0), 0);
    }, [filteredATR]);

    const totalActATRCost = useMemo(() => {
        return filteredATR.reduce((acc, a) => acc + Number(a.actual_cost || 0), 0);
    }, [filteredATR]);

    // Rider Fleet Statistics
    const totalRiders = riderData.length;
    const availableRiders = useMemo(() => riderData.filter(r => (r.availability_status || 'Available') === 'Available').length, [riderData]);
    const busyRiders = useMemo(() => riderData.filter(r => r.availability_status === 'Busy').length, [riderData]);
    const offlineRiders = Math.max(0, totalRiders - availableRiders - busyRiders);

    // Vehicle Type Breakdown
    const vehicleDistributionData = useMemo(() => {
        const counts = {};
        riderData.forEach(r => {
            const type = r.Vehicle_Type || 'Unassigned';
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
    }, [riderData]);

    // ATR Request Status Breakdown
    const atrStatusData = useMemo(() => {
        const counts = { Approved: 0, Pending: 0, Completed: 0, Rejected: 0, Other: 0 };
        filteredATR.forEach(a => {
            const st = a.status || 'Pending';
            if (counts[st] !== undefined) {
                counts[st] += 1;
            } else {
                counts['Other'] += 1;
            }
        });
        return [
            { name: 'Approved', value: counts.Approved, color: '#10B981' },
            { name: 'Pending', value: counts.Pending, color: '#F59E0B' },
            { name: 'Completed', value: counts.Completed, color: '#3B82F6' },
            { name: 'Rejected/Other', value: counts.Rejected + counts.Other, color: '#EF4444' }
        ].filter(item => item.value > 0);
    }, [filteredATR]);

    // Courier Booking Status Data
    const courierStatusData = useMemo(() => {
        const counts = { Delivered: 0, Pending: 0, 'In Transit': 0, Cancelled: 0 };
        filteredCourier.forEach(c => {
            const st = c.status || 'Pending';
            if (counts[st] !== undefined) {
                counts[st] += 1;
            } else {
                counts['Pending'] += 1;
            }
        });
        return [
            { name: 'Delivered', count: counts.Delivered, fill: '#10B981' },
            { name: 'Pending', count: counts.Pending, fill: '#F59E0B' },
            { name: 'In Transit', count: counts['In Transit'], fill: '#3B82F6' },
            { name: 'Cancelled', count: counts.Cancelled, fill: '#EF4444' }
        ];
    }, [filteredCourier]);

    // Customer Breakdown
    const customerTypeData = useMemo(() => {
        let corporate = 0;
        let individual = 0;
        customerData.forEach(c => {
            if (String(c.cust_type || '').toLowerCase() === 'corporate') corporate++;
            else individual++;
        });
        return [
            { name: 'Individual Clients', value: individual, color: '#6366F1' },
            { name: 'Corporate Clients', value: corporate, color: '#8B5CF6' }
        ];
    }, [customerData]);

    // Financial Comparison Chart Data
    const financialOverviewData = useMemo(() => {
        return [
            { category: 'Invoices Issued', amount: totalInvoiced },
            { category: 'Payments Received', amount: totalPaid },
            { category: 'ATR Est. Cost', amount: totalEstATRCost },
            { category: 'ATR Actual Cost', amount: totalActATRCost }
        ];
    }, [totalInvoiced, totalPaid, totalEstATRCost, totalActATRCost]);

    // Print graphical report handler
    const handlePrintReport = () => {
        window.print();
    };

    return (
        <div ref={reportRef} className="graphical-report-container" style={{ color: '#F3F4F6' }}>
            {/* Header & Filter Controls */}
            <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '1.25rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <i className='bx bx-pie-chart-alt-2' style={{ color: '#F59E0B' }}></i> System Analytics & Graphical Reports
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', color: '#9CA3AF' }}>
                        Live graphical visual metrics pulled directly from system database
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
                    {/* Time Filter Buttons */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '3px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: '30days', label: 'Last 30 Days' },
                            { key: '7days', label: 'Last 7 Days' }
                        ].map(btn => (
                            <button
                                key={btn.key}
                                onClick={() => setTimeFilter(btn.key)}
                                style={{
                                    background: timeFilter === btn.key ? '#F59E0B' : 'transparent',
                                    color: timeFilter === btn.key ? '#000' : '#D1D5DB',
                                    border: 'none',
                                    padding: '0.4rem 0.9rem',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#FFF',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <i className={`bx bx-refresh ${isLoading ? 'bx-spin' : ''}`}></i> Refresh
                    </button>

                    <button
                        onClick={handlePrintReport}
                        style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60A5FA',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <i className='bx bx-printer'></i> Print / Export PDF
                    </button>

                    {onExportCSV && (
                        <button
                            onClick={onExportCSV}
                            style={{
                                background: '#F59E0B',
                                color: '#000',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '10px',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                            }}
                        >
                            <i className='bx bx-download'></i> Download CSV
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Metric Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                {/* Revenue KPI Card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '16px',
                    padding: '1.25rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: '500' }}>Payments Received</span>
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '0.4rem', borderRadius: '10px' }}>
                            <i className='bx bx-dollar-circle' style={{ fontSize: '1.4rem' }}></i>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#10B981', margin: '0.5rem 0 0.2rem 0' }}>
                        LKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#6EE7B7' }}>
                        Invoiced: LKR {totalInvoiced.toLocaleString()}
                    </span>
                </div>

                {/* ATR Request KPI Card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02))',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '16px',
                    padding: '1.25rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: '500' }}>ATR Travel Requests</span>
                        <div style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', padding: '0.4rem', borderRadius: '10px' }}>
                            <i className='bx bx-car' style={{ fontSize: '1.4rem' }}></i>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#F59E0B', margin: '0.5rem 0 0.2rem 0' }}>
                        {filteredATR.length} <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 'normal' }}>Requests</span>
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#FCD34D' }}>
                        Cost: LKR {totalActATRCost > 0 ? totalActATRCost.toLocaleString() : totalEstATRCost.toLocaleString()}
                    </span>
                </div>

                {/* Rider Fleet Availability KPI Card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '16px',
                    padding: '1.25rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: '500' }}>Courier Rider Fleet</span>
                        <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6', padding: '0.4rem', borderRadius: '10px' }}>
                            <i className='bx bx-group' style={{ fontSize: '1.4rem' }}></i>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#60A5FA', margin: '0.5rem 0 0.2rem 0' }}>
                        {totalRiders} <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 'normal' }}>Riders</span>
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#93C5FD' }}>
                        {availableRiders} Available | {busyRiders} Busy
                    </span>
                </div>

                {/* Courier Bookings KPI Card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.02))',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '16px',
                    padding: '1.25rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: '500' }}>Courier Bookings</span>
                        <div style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#8B5CF6', padding: '0.4rem', borderRadius: '10px' }}>
                            <i className='bx bx-package' style={{ fontSize: '1.4rem' }}></i>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#A78BFA', margin: '0.5rem 0 0.2rem 0' }}>
                        {filteredCourier.length} <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 'normal' }}>Shipments</span>
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#C4B5FD' }}>
                        {customerData.length} Registered Customers
                    </span>
                </div>
            </div>

            {/* Main Graphical Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {/* Graphical Chart 1: Financial & Cost Summary */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    minHeight: '340px'
                }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#FFF', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className='bx bx-bar-chart-alt-2' style={{ color: '#10B981' }}></i> Financial & Cost Overview (LKR)
                    </h4>
                    {financialOverviewData.length > 0 ? (
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={financialOverviewData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="category" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '10px', color: '#FFF' }}
                                        formatter={(value) => [`LKR ${Number(value).toLocaleString()}`, 'Amount']}
                                    />
                                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                        {financialOverviewData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>No financial data available</div>
                    )}
                </div>

                {/* Graphical Chart 2: ATR Travel Request Status */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    minHeight: '340px'
                }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#FFF', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className='bx bx-doughnut-chart' style={{ color: '#F59E0B' }}></i> ATR Travel Requests Status Breakdown
                    </h4>
                    {atrStatusData.length > 0 ? (
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={atrStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={95}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {atrStatusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '10px', color: '#FFF' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>No ATR request data available</div>
                    )}
                </div>

                {/* Graphical Chart 3: Courier Rider Fleet Vehicle Type Distribution */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    minHeight: '340px'
                }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#FFF', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className='bx bx-cycling' style={{ color: '#3B82F6' }}></i> Rider Fleet Composition by Vehicle Type
                    </h4>
                    {vehicleDistributionData.length > 0 ? (
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vehicleDistributionData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                                    <YAxis dataKey="name" type="category" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '10px', color: '#FFF' }} />
                                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>No rider vehicle data recorded</div>
                    )}
                </div>

                {/* Graphical Chart 4: Courier Booking Delivery Status Funnel */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    minHeight: '340px'
                }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#FFF', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className='bx bx-package' style={{ color: '#8B5CF6' }}></i> Courier Shipment Status Breakdown
                    </h4>
                    {courierStatusData.length > 0 ? (
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={courierStatusData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '10px', color: '#FFF' }} />
                                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                        {courierStatusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>No courier shipment data available</div>
                    )}
                </div>
            </div>

            {/* Detailed Executive Summary Panel */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.5rem'
            }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#FFF', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className='bx bx-list-check' style={{ color: '#10B981' }}></i> System Operational Summary
                </h4>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1.25rem',
                    fontSize: '0.9rem'
                }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#9CA3AF', display: 'block', marginBottom: '0.3rem' }}>Administrative Staff</span>
                        <strong style={{ fontSize: '1.2rem', color: '#FFF' }}>{staffData.length} Registered</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#10B981', marginTop: '0.3rem' }}>
                            {staffData.filter(s => s.staff_active_status !== false).length} Active Staff Members
                        </span>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#9CA3AF', display: 'block', marginBottom: '0.3rem' }}>Customer Base</span>
                        <strong style={{ fontSize: '1.2rem', color: '#FFF' }}>{customerData.length} Registered</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#A78BFA', marginTop: '0.3rem' }}>
                            {customerTypeData.find(c => c.name.includes('Corporate'))?.value || 0} Corporate Clients
                        </span>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#9CA3AF', display: 'block', marginBottom: '0.3rem' }}>Rider Fleet Status</span>
                        <strong style={{ fontSize: '1.2rem', color: '#FFF' }}>{totalRiders} Total Fleet</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#60A5FA', marginTop: '0.3rem' }}>
                            {((availableRiders / (totalRiders || 1)) * 100).toFixed(0)}% Fleet Availability Ratio
                        </span>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#9CA3AF', display: 'block', marginBottom: '0.3rem' }}>ATR Clearance Rate</span>
                        <strong style={{ fontSize: '1.2rem', color: '#FFF' }}>
                            {filteredATR.length ? `${((filteredATR.filter(a => a.status === 'Completed').length / filteredATR.length) * 100).toFixed(0)}%` : 'N/A'}
                        </strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#FCD34D', marginTop: '0.3rem' }}>
                            {filteredATR.filter(a => a.status === 'Approved').length} Approved & Active
                        </span>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body { background: #FFF !important; color: #000 !important; }
                    .no-print { display: none !important; }
                    .graphical-report-container { color: #000 !important; padding: 0 !important; }
                    .graphical-report-container div { border-color: #DDD !important; background: #FFF !important; color: #000 !important; }
                    .graphical-report-container h2, .graphical-report-container h3, .graphical-report-container h4, .graphical-report-container strong { color: #000 !important; }
                }
            `}</style>
        </div>
    );
}
