import React, { useState, useEffect } from 'react';

const StatsSection = () => {
    // Target Values
    const TARGETS = {
        total: 842,
        ongoing: 55,
        riders: 4,
        satisfaction: 99.4
    };

    // State for displayed numbers
    const [total, setTotal] = useState(0);
    const [ongoing, setOngoing] = useState(0);
    const [riders, setRiders] = useState(0);
    const [satisfaction, setSatisfaction] = useState(0);

    // Pulse state to trigger visual animations on update
    const [pulseStates, setPulseStates] = useState({
        total: false,
        ongoing: false,
        riders: false,
        satisfaction: false
    });

    const triggerPulse = (key) => {
        setPulseStates(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setPulseStates(prev => ({ ...prev, [key]: false }));
        }, 400); // matches the CSS animation duration
    };

    // 1. Mount Count-up animation
    useEffect(() => {
        const duration = 1200; // ms
        const steps = 30;
        const stepTime = duration / steps;
        
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            
            // Ease out quad formula for smooth count-up
            const easeOutQuad = progress * (2 - progress);

            setTotal(Math.floor(easeOutQuad * TARGETS.total));
            setOngoing(Math.floor(easeOutQuad * TARGETS.ongoing));
            setRiders(Math.floor(easeOutQuad * TARGETS.riders));
            setSatisfaction(parseFloat((easeOutQuad * TARGETS.satisfaction).toFixed(1)));

            if (currentStep >= steps) {
                clearInterval(timer);
                // Ensure exact final targets
                setTotal(TARGETS.total);
                setOngoing(TARGETS.ongoing);
                setRiders(TARGETS.riders);
                setSatisfaction(TARGETS.satisfaction);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, []);

    // 2. Periodic fluctuations
    useEffect(() => {
        // Total completed deliveries ticks up slowly
        const totalInterval = setInterval(() => {
            setTotal(prev => {
                const next = prev + 1;
                triggerPulse('total');
                return next;
            });
        }, 12000); // every 12 seconds

        // Ongoing shipments fluctuates up and down
        const ongoingInterval = setInterval(() => {
            setOngoing(prev => {
                // Change by -2, -1, 0, 1, or 2
                const change = Math.floor(Math.random() * 5) - 2;
                const next = Math.max(120, Math.min(220, prev + change));
                if (change !== 0) {
                    triggerPulse('ongoing');
                }
                return next;
            });
        }, 7000); // every 7 seconds

        // Active riders fluctuates slightly
        const ridersInterval = setInterval(() => {
            setRiders(prev => {
                // Change by -1, 0, or 1
                const change = Math.floor(Math.random() * 3) - 1;
                const next = Math.max(45, Math.min(60, prev + change));
                if (change !== 0) {
                    triggerPulse('riders');
                }
                return next;
            });
        }, 10000); // every 10 seconds

        return () => {
            clearInterval(totalInterval);
            clearInterval(ongoingInterval);
            clearInterval(ridersInterval);
        };
    }, []);

    return (
        <div className="stats-container">
            <div className="stat-card">
                <div className="stat-icon-wrapper">
                    <i className="bx bx-package"></i>
                </div>
                <div className={`stat-number ${pulseStates.total ? 'pulse' : ''}`}>
                    {total.toLocaleString()}+
                </div>
                <div className="stat-label">Total Deliveries</div>
                <div className="stat-trend up">
                    <i className="bx bx-trending-up"></i>
                    <span>Live Completing</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon-wrapper">
                    <i className="bx bx-navigation"></i>
                </div>
                <div className={`stat-number ${pulseStates.ongoing ? 'pulse' : ''}`}>
                    {ongoing}
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
                <div className={`stat-number ${pulseStates.riders ? 'pulse' : ''}`}>
                    {riders}
                </div>
                <div className="stat-label">Active Riders</div>
                <div className="stat-trend up">
                    <i className="bx bx-circle bx-pulse" style={{ fontSize: '0.6rem', marginRight: '0.1rem', color: 'var(--success)' }}></i>
                    <span>On Duty</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon-wrapper">
                    <i className="bx bx-like"></i>
                </div>
                <div className={`stat-number ${pulseStates.satisfaction ? 'pulse' : ''}`}>
                    {satisfaction}%
                </div>
                <div className="stat-label">Satisfaction Rate</div>
                <div className="stat-trend up">
                    <i className="bx bxs-star" style={{ color: '#fbbf24' }}></i>
                    <span>Top Rated</span>
                </div>
            </div>
        </div>
    );
};

export default StatsSection;
