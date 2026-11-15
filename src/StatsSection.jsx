import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const StatsSection = () => {
    const [total, setTotal] = useState(0);
    const [ongoing, setOngoing] = useState(0);
    const [riders, setRiders] = useState(0);

    useEffect(() => {
        const loadLiveStats = async () => {
            try {
                const [{ data: atrs }, { data: pds }, { data: ridersData }] = await Promise.all([
                    supabase.from('atr').select('status'),
                    supabase.from('personal_delivery').select('status'),
                    supabase.from('rider').select('availability_status')
                ]);

                const orders = [...(atrs || []), ...(pds || [])];
                const completedCount = orders.filter(o => ['completed', 'delivered'].includes(String(o.status || '').toLowerCase())).length;
                const ongoingCount = orders.filter(o => ['assigned', 'in transit', 'on delivery', 'picked up'].includes(String(o.status || '').toLowerCase())).length;
                const activeRidersCount = (ridersData || []).filter(r => !['off duty', 'offline', 'inactive', 'on break', 'unavailable'].includes(String(r.availability_status || 'Available').toLowerCase())).length;

                setTotal(completedCount);
                setOngoing(ongoingCount);
                setRiders(activeRidersCount);
            } catch (err) {
                console.warn('Note loading live stats:', err);
            }
        };

        loadLiveStats();
    }, []);

    return (
        <div className="stats-container">
            <div className="stat-card">
                <div className="stat-icon-wrapper">
                    <i className="bx bx-package"></i>
                </div>
                <div className="stat-number">
                    {total.toLocaleString()}
                </div>
                <div className="stat-label">Completed Deliveries</div>
                <div className="stat-trend up">
                    <i className="bx bx-check-circle"></i>
                    <span>Live Database Count</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon-wrapper">
                    <i className="bx bx-navigation"></i>
                </div>
                <div className="stat-number">
                    {ongoing.toLocaleString()}
                </div>
                <div className="stat-label">Ongoing Shipments</div>
                <div className="stat-trend up">
                    <i className="bx bx-wifi"></i>
                    <span>Active Tracking</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon-wrapper">
                    <i className="bx bx-user-voice"></i>
                </div>
                <div className="stat-number">
                    {riders.toLocaleString()}
                </div>
                <div className="stat-label">Active Riders</div>
                <div className="stat-trend up">
                    <i className="bx bx-circle" style={{ fontSize: '0.6rem', marginRight: '0.1rem', color: 'var(--success)' }}></i>
                    <span>On Duty</span>
                </div>
            </div>
        </div>
    );
};

export default StatsSection;
