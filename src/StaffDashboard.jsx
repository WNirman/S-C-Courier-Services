import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { generateMonthlyExcelReport } from './utils/reportGenerator';
import { getCachedPricingRates, fetchPricingRates } from './utils/pricingRates';
import { fetchLockedActuals, resolveOrderActualsState, calculateCostFromDistance, saveAndLockOrderActuals } from './utils/actualsHelper';

const StaffDashboard = ({ loggedInUser }) => {
    const [staffProfile, setStaffProfile] = useState(null);
    const [ridersList, setRidersList] = useState([]);
    const [atrRequests, setAtrRequests] = useState([]);
    const [personalDeliveries, setPersonalDeliveries] = useState([]);
    const [deliveriesList, setDeliveriesList] = useState([]);
    const [deptCompMap, setDeptCompMap] = useState({});
    const [customerCompMap, setCustomerCompMap] = useState({});

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'deliveries' | 'atr' | 'riders'
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'assigned' | 'completed'

    // Report generation state
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportMonth, setReportMonth] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    // Actuals completion modal (ATR + Private Delivery) & lock tracking
    const [lockedActualsMap, setLockedActualsMap] = useState({});
    const [completingOrder, setCompletingOrder] = useState(null);
    const [actualDistanceInput, setActualDistanceInput] = useState('');
    const [actualCostInput, setActualCostInput] = useState('');
    const [submittingActuals, setSubmittingActuals] = useState(false);

    const loadLockedActuals = async () => {
        const map = await fetchLockedActuals();
        setLockedActualsMap(map || {});
    };

    useEffect(() => {
        loadLockedActuals();
    }, []);

    // ── 1. Load Staff Profile ──────────────────────────────────────────
    const loadStaffProfile = async () => {
        if (!loggedInUser) return;
        try {
            const { data, error } = await supabase
                .from('staff')
                .select('staff_id, staff_name, staff_email, staff_phone, staff_active_status')
                .eq('staff_email', loggedInUser)
                .single();

            if (data && !error) {
                setStaffProfile(data);
            } else {
                setStaffProfile({
                    staff_name: 'Operations Staff',
                    staff_email: loggedInUser,
                    staff_phone: 'N/A'
                });
            }
        } catch (e) {
            console.warn('Staff profile load error:', e);
            setStaffProfile({ staff_name: 'Operations Staff', staff_email: loggedInUser });
        }
    };

    // ── 2. Load Mobile App Fleet (Riders) ──────────────────────────────
    const loadRiders = async () => {
        let rawRiders = null;
        try {
            const { data, error } = await supabase
                .from('rider')
                .select('*');

            if (!error && data && data.length > 0) {
                rawRiders = data;
            }
        } catch (err) {
            console.warn('Supabase fetch riders note:', err);
        }

        if (!rawRiders || rawRiders.length === 0) {
            try {
                const res = await fetch('http://localhost:5000/api/riders');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) rawRiders = data;
                }
            } catch (e) {
                console.warn('Backend fetch riders note:', e);
            }
        }

        if (rawRiders && Array.isArray(rawRiders)) {
            setRidersList(rawRiders.map(r => ({
                nic: r.nic || r.NIC || '',
                name: r.name || r.Name || 'Rider',
                phone: r.phone_number || r.Phone_Number || r.phone || 'N/A',
                branch: r.branch || r.Branch || 'Main Branch',
                vehicleType: r.vehicle_type || r.Vehicle_Type || 'Bike',
                vehicleNumber: r.vehicle_number || r.Vehicle_Number || 'N/A',
                licenceNo: r.driver_licence_no || r.Driver_Licence_No || 'N/A',
                availability: r.availability_status || r.availability || 'Available',
                email: r.email || r.Email || ''
            })));
        }
    };

    // ── 2b. Load Linked Deliveries & Trips ─────────────────────────────
    const loadDeliveries = async () => {
        try {
            const { data, error } = await supabase
                .from('delivery')
                .select('del_id, trip_id, delivery_status, source_type, source_id, trip(trip_id, rider_nic, trip_status)');
            if (!error && data) {
                setDeliveriesList(data);
            }
        } catch (e) {
            console.warn('Note loading deliveries:', e);
        }
    };

    // ── 3. Load ATR Requests ───────────────────────────────────────────
    const loadAtrRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('atr')
                .select('*')
                .order('atr_id', { ascending: false });

            if (!error && data) {
                setAtrRequests(data);
            }

            // Department / Company map
            try {
                const { data: deptData } = await supabase
                    .from('department')
                    .select('dep_id, dep_name, comp_id, company(comp_id, comp_name, comp_address)');
                if (deptData) {
                    const dMap = {};
                    deptData.forEach(d => {
                        dMap[d.dep_id] = {
                            dep_name: d.dep_name,
                            comp_name: d.company?.comp_name || 'SC Courier Corporate Client',
                            comp_address: d.company?.comp_address || ''
                        };
                    });
                    setDeptCompMap(dMap);
                }

                const { data: custData } = await supabase
                    .from('customer')
                    .select('cust_email, cust_name, cust_type');
                if (custData) {
                    const cMap = {};
                    custData.forEach(c => {
                        cMap[c.cust_email] = c.cust_name || (c.cust_type === 'Corporate' ? 'Corporate Client' : null);
                    });
                    setCustomerCompMap(cMap);
                }
            } catch (e) {
                console.warn('Note loading dept/comp relations:', e);
            }
        } catch (err) {
            console.error('Error fetching ATRs:', err);
        }
    };

    // ── 4. Load Personal Deliveries ────────────────────────────────────
    const loadPersonalDeliveries = async () => {
        try {
            const { data, error } = await supabase
                .from('personal_delivery')
                .select('*')
                .order('pd_id', { ascending: false });

            if (!error && data) {
                setPersonalDeliveries(data);
                return;
            }
        } catch (sbErr) {
            console.warn('Supabase fetch error, checking backend:', sbErr);
        }

        try {
            const res = await fetch('http://localhost:5000/api/personal-deliveries');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setPersonalDeliveries(data);
            }
        } catch (e) {
            console.error('Backend fetch error:', e);
        }
    };

    // Master load
    const refreshAll = async () => {
        setLoading(true);
        await Promise.all([
            loadStaffProfile(),
            loadRiders(),
            loadAtrRequests(),
            loadPersonalDeliveries(),
            loadDeliveries()
        ]);
        setLoading(false);
    };

    // Realtime subscription + 5s background sync for seamless multi-PC updates
    useEffect(() => {
        refreshAll();
        fetchPricingRates();

        const liveChannel = supabase
            .channel('staff-multi-pc-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'atr' }, () => loadAtrRequests())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_delivery' }, () => loadPersonalDeliveries())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery' }, () => loadDeliveries())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trip' }, () => loadDeliveries())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rider' }, () => loadRiders())
            .subscribe();

        return () => {
            supabase.removeChannel(liveChannel);
        };
    }, [loggedInUser]);

    // ── Dispatch / Assignment Handlers ─────────────────────────────────

    // Assign Rider to Personal Delivery
    const handleAssignRiderToPD = async (pdId, riderNic) => {
        try {
            const selectedRider = ridersList.find(r => r.nic === riderNic);
            const riderName = selectedRider ? selectedRider.name : riderNic;

            // When unassigning, revert to 'Accepted' (the PD was already accepted by staff)
            const revertStatus = (() => {
                const pd = personalDeliveries.find(p => p.pd_id === pdId);
                // Keep the previous accepted status; fall back to 'Accepted'
                return (pd?.status && pd.status !== 'Assigned') ? pd.status : 'Accepted';
            })();

            // 1. Direct update in Supabase cloud
            const updatePayload = riderNic
                ? { status: 'Assigned', assigned_rider_nic: riderNic }
                : { status: revertStatus, assigned_rider_nic: null };

            const { error: sbErr } = await supabase
                .from('personal_delivery')
                .update(updatePayload)
                .eq('pd_id', pdId);

            if (sbErr) {
                alert('Failed to update delivery: ' + sbErr.message);
                return;
            }

            // Optimistic local update so UI reflects change immediately
            setPersonalDeliveries(prev => prev.map(p =>
                p.pd_id === pdId
                    ? { ...p, ...updatePayload }
                    : p
            ));

            // 2. Create trip + delivery in Supabase
            if (riderNic) {
                const pdObj = personalDeliveries.find(p => p.pd_id === pdId);
                let backendOk = false;
                try {
                    const tdRes = await fetch('http://localhost:5000/api/trip-delivery/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rider_nic: riderNic,
                            trip_date: pdObj?.requested_date || pdObj?.scheduled_date || new Date().toISOString().split('T')[0],
                            pick_location: pdObj?.pickup_address || '',
                            drop_location: pdObj?.drop_address || '',
                            book_id: null,
                            source_type: 'personal',
                            source_id: pdId,
                            staff_id: staffProfile?.staff_id || null
                        })
                    });
                    if (tdRes.ok) backendOk = true;
                } catch (e) {
                    console.warn('Backend server offline, writing directly to Supabase...');
                }

                if (!backendOk) {
                    try {
                        const { data: tripData } = await supabase
                            .from('trip')
                            .insert({
                                rider_nic: riderNic,
                                trip_date: pdObj?.requested_date || pdObj?.scheduled_date || new Date().toISOString().split('T')[0],
                                trip_status: 'scheduled',
                                created_by: staffProfile?.staff_id || null
                            })
                            .select('trip_id')
                            .single();

                        if (tripData) {
                            await supabase.from('delivery').insert({
                                trip_id: tripData.trip_id,
                                pick_location: pdObj?.pickup_address || '',
                                drop_location: pdObj?.drop_address || '',
                                delivery_status: 'assigned',
                                source_type: 'personal',
                                source_id: pdId
                            });
                        }
                    } catch (directErr) {
                        console.warn('Direct trip/delivery create note:', directErr);
                    }
                }
            } else {
                // Cancel/Delete the linked trip and delivery
                try {
                    const { data: delRows } = await supabase
                        .from('delivery')
                        .select('del_id, trip_id')
                        .eq('source_type', 'personal')
                        .eq('source_id', pdId);
                    if (delRows && delRows.length > 0) {
                        const tripIds = delRows.map(r => r.trip_id).filter(Boolean);
                        await supabase.from('delivery').delete().eq('source_type', 'personal').eq('source_id', pdId);
                        if (tripIds.length > 0) {
                            await supabase.from('trip').delete().in('trip_id', tripIds);
                        }
                    }
                } catch (e) {
                    console.warn('Unassign cleanup note:', e);
                }
            }

            if (riderNic) {
                alert(`Rider (${riderName}) successfully assigned to delivery PD-${pdId}!`);
            }
            loadPersonalDeliveries();
            loadDeliveries();
            loadRiders();
        } catch (err) {
            console.error('Error assigning rider to PD:', err);
            alert('Assignment error: ' + err.message);
        }
    };

    // Assign Rider to ATR
    const handleAssignRiderToATR = async (atrId, riderNic) => {
        try {
            const selectedRider = ridersList.find(r => r.nic === riderNic);
            const riderName = selectedRider ? selectedRider.name : riderNic;

            // 1. Direct update in Supabase cloud
            const { error: sbErr } = await supabase
                .from('atr')
                .update({
                    status: riderNic ? 'Assigned' : 'Approved',
                    assigned_rider_nic: riderNic || null
                })
                .eq('atr_id', atrId);

            if (sbErr) {
                alert('Failed to update ATR: ' + sbErr.message);
                return;
            }

            // 2. Create trip + delivery in Supabase
            if (riderNic) {
                const atrObj = atrRequests.find(a => a.atr_id === atrId);
                const deptInfo = deptCompMap[atrObj?.dep_id];
                const startingOffice = deptInfo?.comp_address || deptInfo?.comp_name || deptInfo?.dep_name || 'Corporate Office';
                let backendOk = false;

                try {
                    const tdRes = await fetch('http://localhost:5000/api/trip-delivery/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rider_nic: riderNic,
                            trip_date: atrObj?.required_date || new Date().toISOString().split('T')[0],
                            pick_location: startingOffice,
                            drop_location: atrObj?.purpose_of_travel || '',
                            book_id: null,
                            source_type: 'atr',
                            source_id: atrId,
                            staff_id: staffProfile?.staff_id || null
                        })
                    });
                    if (tdRes.ok) backendOk = true;
                } catch (e) {
                    console.warn('Backend server offline, writing directly to Supabase...');
                }

                if (!backendOk) {
                    try {
                        const { data: tripData } = await supabase
                            .from('trip')
                            .insert({
                                rider_nic: riderNic,
                                trip_date: atrObj?.required_date || new Date().toISOString().split('T')[0],
                                trip_status: 'scheduled',
                                created_by: staffProfile?.staff_id || null
                            })
                            .select('trip_id')
                            .single();

                        if (tripData) {
                            await supabase.from('delivery').insert({
                                trip_id: tripData.trip_id,
                                pick_location: startingOffice,
                                drop_location: atrObj?.purpose_of_travel || '',
                                delivery_status: 'assigned',
                                source_type: 'atr',
                                source_id: atrId
                            });
                        }
                    } catch (directErr) {
                        console.warn('Direct trip/delivery create note:', directErr);
                    }
                }
            } else {
                // Cancel/Delete the linked trip and delivery
                try {
                    const { data: delRows } = await supabase
                        .from('delivery')
                        .select('del_id, trip_id')
                        .eq('source_type', 'atr')
                        .eq('source_id', atrId);
                    if (delRows && delRows.length > 0) {
                        const tripIds = delRows.map(r => r.trip_id).filter(Boolean);
                        await supabase.from('delivery').delete().eq('source_type', 'atr').eq('source_id', atrId);
                        if (tripIds.length > 0) {
                            await supabase.from('trip').delete().in('trip_id', tripIds);
                        }
                    }
                } catch (e) {
                    console.warn('Unassign cleanup note:', e);
                }
            }

            alert(riderNic ? `Rider (${riderName}) successfully assigned to ATR-${atrId}!` : 'Rider unassigned.');
            loadAtrRequests();
            loadRiders();
        } catch (err) {
            console.error('Error assigning rider to ATR:', err);
            alert('Assignment error: ' + err.message);
        }
    };

    // Approve / Accept Handlers
    const handleAcceptPD = async (pdId) => {
        try {
            const acceptedByEmail = loggedInUser || 'staff@sccourier.com';
            const { error } = await supabase
                .from('personal_delivery')
                .update({
                    status: 'Accepted',
                    accepted_by: acceptedByEmail,
                    accepted_at: new Date().toISOString()
                })
                .eq('pd_id', pdId);

            if (error) throw error;

            let invoiceNote = '';
            try {
                const res = await fetch('http://localhost:5000/api/delivery/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pdId, acceptedBy: acceptedByEmail, status: 'Accepted' })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.invoiceNo) {
                        invoiceNote = `\nInvoice #${data.invoiceNo} has been emailed to the customer.`;
                    }
                }
            } catch (emailErr) {
                console.warn('PD invoice email note:', emailErr);
            }

            alert('Delivery order accepted! You can now match a rider.' + invoiceNote);
            loadPersonalDeliveries();
        } catch (e) {
            alert('Error accepting delivery: ' + e.message);
        }
    };

    const handleApproveATR = async (atrId) => {
        try {
            const approvedByEmail = loggedInUser || 'staff@sccourier.com';
            const { error } = await supabase
                .from('atr')
                .update({
                    status: 'Approved',
                    approval_date: new Date().toISOString()
                })
                .eq('atr_id', atrId);

            if (error) throw error;

            let invoiceNote = '';
            try {
                const res = await fetch('http://localhost:5000/api/atr/approve-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ atrId, approvedBy: approvedByEmail })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.invoiceNo) {
                        invoiceNote = `\nInvoice #${data.invoiceNo} has been sent to ${data.email}.`;
                    }
                }
            } catch (emailErr) {
                console.warn('ATR invoice email note:', emailErr);
            }

            alert('ATR request approved! You can now match a rider.' + invoiceNote);
            loadAtrRequests();
        } catch (e) {
            alert('Error approving ATR: ' + e.message);
        }
    };

    // Actuals completion modal (ATR + Private Delivery)
    const handleOpenActualsModal = (type, rawItem) => {
        const pricing = getCachedPricingRates();
        const state = resolveOrderActualsState(type, rawItem, lockedActualsMap, pricing);
        if (state.isLocked) {
            alert('Actual distance and cost for this order are already locked and cannot be modified.');
            return;
        }
        setCompletingOrder({
            type: state.type,
            rawItem,
            estDist: state.estDist,
            estCost: state.estCost,
            rate: state.rate,
            baseFee: state.baseFee,
            actDist: state.actDist,
            actCost: state.actCost,
            refLabel: state.type === 'atr' ? (rawItem.atr_number || `ATR-${rawItem.atr_id}`) : `PD-${rawItem.pd_id}`,
            titleLabel: state.type === 'atr'
                ? `${rawItem.principal_passenger_name || 'Staff'} (${rawItem.vehicle_type || 'Car'})`
                : `${rawItem.sender_name || rawItem.cust_email || 'Customer'} (${rawItem.item_type || 'Parcel'})`
        });
        // Start with estimated values whenever actuals are empty
        setActualDistanceInput(state.startDist);
        setActualCostInput(state.startCost);
    };

    const handleSaveActuals = async (e) => {
        e.preventDefault();
        if (!completingOrder) return;
        setSubmittingActuals(true);
        try {
            const actualDistNum = parseFloat(actualDistanceInput);
            const actualCostNum = parseFloat(actualCostInput);
            const result = await saveAndLockOrderActuals({
                type: completingOrder.type,
                item: completingOrder.rawItem,
                actualDistance: actualDistNum,
                actualCost: actualCostNum,
                estDist: completingOrder.estDist,
                estCost: completingOrder.estCost,
                recordedBy: staffProfile?.staff_email || loggedInUser || 'Staff',
                supabase
            });

            const lockRec = result.lockRecord;
            if (lockRec?.key) {
                setLockedActualsMap(prev => ({ ...prev, [lockRec.key]: lockRec }));
            }

            if (completingOrder.type === 'atr') {
                const targetId = completingOrder.rawItem.atr_id;
                setAtrRequests(prev => prev.map(a =>
                    a.atr_id === targetId
                        ? { ...a, status: 'Completed', actual_distance: actualDistNum, actual_cost: actualCostNum, actuals_locked: true }
                        : a
                ));
                loadAtrRequests();
            } else {
                const targetId = completingOrder.rawItem.pd_id;
                setPersonalDeliveries(prev => prev.map(p =>
                    p.pd_id === targetId
                        ? { ...p, status: 'Completed', actual_distance: actualDistNum, actual_cost: actualCostNum, actuals_locked: true }
                        : p
                ));
                loadPersonalDeliveries();
            }

            const invoiceNote = result.updatedInvoicesCount > 0
                ? `\n\nUpdated ${result.updatedInvoicesCount} invoice(s) with actual values.`
                : '';
            alert(`${result.message}${invoiceNote}`);
            setCompletingOrder(null);
        } catch (err) {
            alert('Failed to record actuals: ' + err.message);
            loadLockedActuals();
        } finally {
            setSubmittingActuals(false);
        }
    };

    // Generate Monthly Statistical Excel Report
    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const res = await generateMonthlyExcelReport(reportMonth, staffProfile?.staff_email || loggedInUser);
            alert(`Monthly Excel Analytics Report (${res.fileName}) generated and downloaded successfully!`);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report: ' + error.message);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // ── Helper to calculate Cost & Distance for Personal Deliveries ──
    const getPdCostDist = (pd) => {
        // 1. Explicit cost & distance
        if (pd.cost && pd.distance) {
            return `${pd.cost} LKR (${pd.distance} km)`;
        }
        if (pd.estimated_cost && pd.estimated_distance) {
            return `${pd.estimated_cost} LKR (${pd.estimated_distance} km)`;
        }

        // 2. Compute from coordinates via Haversine
        let distKm = null;
        if (pd.pickup_lat && pd.pickup_lng && pd.drop_lat && pd.drop_lng) {
            const pLat = parseFloat(pd.pickup_lat);
            const pLng = parseFloat(pd.pickup_lng);
            const dLat = parseFloat(pd.drop_lat);
            const dLng = parseFloat(pd.drop_lng);
            if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng)) {
                const R = 6371;
                const dL = (dLat - pLat) * Math.PI / 180;
                const dG = (dLng - pLng) * Math.PI / 180;
                const a = Math.sin(dL / 2) * Math.sin(dL / 2) +
                          Math.cos(pLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) *
                          Math.sin(dG / 2) * Math.sin(dG / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distKm = (R * c * 1.3).toFixed(1);
            }
        }

        if (distKm && parseFloat(distKm) > 0) {
            const rateMap = getCachedPricingRates().vehicleRates || {};
            const bikeRate = Number(rateMap['Bike']) || 50;
            const calculatedCost = pd.cost || Math.round(200 + parseFloat(distKm) * bikeRate);
            return `${calculatedCost} LKR (${distKm} km)`;
        }

        // 3. Fallback when cost is set without distance
        if (pd.cost) {
            const estDist = (parseFloat(pd.cost) / 60).toFixed(1);
            return `${pd.cost} LKR (${estDist} km)`;
        }

        // 4. Default standard courier formula (same format as corporate)
        const weightNum = parseFloat(pd.item_weight) || 1;
        const standardCost = Math.round(350 + Math.max(0, weightNum - 1) * 80);
        const standardDist = (5.0 + Math.min(10, ((pd.pd_id || 1) % 6) * 1.5)).toFixed(1);
        return `${standardCost} LKR (${standardDist} km)`;
    };

    // ── Build Unified Order Items ──────────────────────────────────────
    const unifiedOrders = (() => {
        const atrItems = atrRequests.map(req => {
            const deptInfo = deptCompMap[req.dep_id];
            const custComp = customerCompMap[req.cust_email];
            const compName = deptInfo?.comp_name || custComp || 'Corporate Client';
            const deptName = deptInfo?.dep_name || 'Operations';

            return {
                id: `atr-${req.atr_id}`,
                rawId: req.atr_id,
                type: 'atr',
                refNumber: req.atr_number || `ATR-${req.atr_id}`,
                status: req.status,
                clientTitle: `${compName} (${deptName})`,
                subtitle: `Passenger: ${req.principal_passenger_name} • ${req.vehicle_type || 'Vehicle'}`,
                route: req.purpose_of_travel || 'Meeting / Travel Assignment',
                schedule: `${req.required_date || 'N/A'} @ ${req.required_time || 'N/A'}`,
                costDist: `${req.estimated_cost || 0} LKR (${req.estimated_distance || 0} km)`,
                assignedRiderNic: req.assigned_rider_nic || req.rider_nic || req.assigned_rider || null,
                rawItem: req
            };
        });

        const pdItems = personalDeliveries.map(pd => ({
            id: `pd-${pd.pd_id}`,
            rawId: pd.pd_id,
            type: 'pd',
            refNumber: `PD-${pd.pd_id}`,
            status: pd.status,
            clientTitle: `Delivery to ${pd.receiver_name || 'Receiver'}`,
            subtitle: `Item: ${pd.item_type || 'Package'} (${pd.item_weight || 'Standard'}) • Sender: ${pd.sender_name || 'Sender'}`,
            route: `${pd.pickup_address} ➔ ${pd.drop_address}`,
            schedule: `${pd.requested_date || pd.scheduled_date || 'N/A'} @ ${pd.requested_time || pd.scheduled_time || 'N/A'}`,
            costDist: getPdCostDist(pd),
            assignedRiderNic: pd.assigned_rider_nic || pd.rider_nic || pd.assigned_rider || null,
            rawItem: pd
        }));

        let list = [];
        if (activeTab === 'all') list = [...atrItems, ...pdItems];
        else if (activeTab === 'deliveries') list = pdItems;
        else if (activeTab === 'atr') list = atrItems;

        if (statusFilter === 'pending') list = list.filter(x => x.status === 'Pending');
        else if (statusFilter === 'approved') list = list.filter(x => (x.status === 'Approved' || x.status === 'Accepted') && !x.assignedRiderNic);
        else if (statusFilter === 'assigned') list = list.filter(x => x.assignedRiderNic || x.status === 'Assigned' || x.status === 'In Transit');
        else if (statusFilter === 'completed') list = list.filter(x => x.status === 'Completed');

        return list;
    })();

    // Statistics counts
    const totalCount = atrRequests.length + personalDeliveries.length;
    const pendingCount = atrRequests.filter(a => a.status === 'Pending').length + personalDeliveries.filter(p => p.status === 'Pending').length;
    const readyToAssignCount = atrRequests.filter(a => a.status === 'Approved' && !a.assigned_rider_nic).length + personalDeliveries.filter(p => (p.status === 'Accepted' || p.status === 'Approved') && !p.assigned_rider_nic).length;
    const assignedCount = atrRequests.filter(a => a.assigned_rider_nic || a.status === 'Assigned').length + personalDeliveries.filter(p => p.assigned_rider_nic || p.status === 'Assigned').length;
    const completedCount = atrRequests.filter(a => a.status === 'Completed').length + personalDeliveries.filter(p => p.status === 'Completed').length;

    // Strict unified grid column specification for 100% pixel-perfect alignment
    const ORDER_GRID_COLUMNS = '130px 1fr 135px 125px 105px 360px';

    return (
        <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease', padding: '2rem', width: '100%', maxWidth: '1400px', margin: '0 auto', zIndex: 10 }}>

            {/* ── Top Header Bar ────────────────────────────────────────── */}
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ textAlign: 'left' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '2rem', fontWeight: '700', color: '#fff', margin: 0 }}>
                        <i className='bx bx-briefcase' style={{ color: 'var(--accent-color)' }}></i> Staff Dashboard
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.92rem' }}>
                        Welcome back, <strong style={{ color: '#fff' }}>{staffProfile?.staff_name || 'Staff Member'}</strong> ({loggedInUser})
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--card-border)', padding: '0 0.75rem', height: '40px', gap: '0.5rem' }}>
                        <i className='bx bx-calendar' style={{ color: 'var(--accent-color)', fontSize: '1.15rem' }}></i>
                        <input
                            type="month"
                            value={reportMonth}
                            onChange={(e) => setReportMonth(e.target.value)}
                            title="Filter Report by Month"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                outline: 'none',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGeneratingReport}
                        title="Download comprehensive monthly analytical Excel (.xlsx) report"
                        className="primary-btn pulse-effect"
                        style={{
                            padding: '0 1rem',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: isGeneratingReport ? 'not-allowed' : 'pointer',
                            opacity: isGeneratingReport ? 0.8 : 1,
                            borderRadius: '8px',
                            background: '#10b981',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                            width: 'auto'
                        }}
                    >
                        {isGeneratingReport ? (
                            <><i className='bx bx-loader-alt bx-spin'></i> Generating...</>
                        ) : (
                            <><i className='bx bx-table'></i> Export Excel</>
                        )}
                    </button>
                    <button
                        onClick={refreshAll}
                        className="secondary-btn"
                        style={{
                            padding: '0 1rem',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            borderRadius: '8px'
                        }}
                    >
                        <i className={`bx bx-refresh ${loading ? 'bx-spin' : ''}`}></i> Refresh Now
                    </button>
                </div>
            </div>

            {/* ── Key Metrics Cards ─────────────────────────────────────── */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="stat-card" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '14px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                        <i className='bx bx-time-five'></i>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.2rem 0' }}>Pending Orders</p>
                        <h3 style={{ color: '#fff', fontSize: '1.7rem', fontWeight: '700', margin: 0 }}>{pendingCount}</h3>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '14px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                        <i className='bx bx-user-check'></i>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.2rem 0' }}>Ready to Assign</p>
                        <h3 style={{ color: '#fff', fontSize: '1.7rem', fontWeight: '700', margin: 0 }}>{readyToAssignCount}</h3>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '14px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                        <i className='bx bx-navigation'></i>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.2rem 0' }}>Assigned / Active</p>
                        <h3 style={{ color: '#fff', fontSize: '1.7rem', fontWeight: '700', margin: 0 }}>{assignedCount}</h3>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '14px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                        <i className='bx bx-check-double'></i>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.2rem 0' }}>Completed Orders</p>
                        <h3 style={{ color: '#fff', fontSize: '1.7rem', fontWeight: '700', margin: 0 }}>{completedCount}</h3>
                    </div>
                </div>
            </div>

            {/* ── Tabs & Filters ─────────────────────────────────────────── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--card-border)'
            }}>
                {/* Section Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                        { id: 'all', label: `All Requests (${totalCount})`, icon: 'bx-layer' },
                        { id: 'deliveries', label: `Deliveries (${personalDeliveries.length})`, icon: 'bx-package' },
                        { id: 'atr', label: `ATR Travel (${atrRequests.length})`, icon: 'bx-briefcase' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            style={{
                                padding: '0.5rem 0.9rem',
                                background: activeTab === t.id ? 'var(--accent-color)' : 'transparent',
                                color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: activeTab === t.id ? '600' : '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <i className={`bx ${t.icon}`}></i> {t.label}
                        </button>
                    ))}
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '0.4rem 0.8rem',
                            background: 'rgba(20, 20, 20, 0.95)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.82rem',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending Approval</option>
                        <option value="approved">Approved (Unassigned)</option>
                        <option value="assigned">Assigned / In Transit</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>

            {/* ── Unified Orders List ── */}
            <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '1160px', width: '100%' }}>
                    {/* Header Bar */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: ORDER_GRID_COLUMNS,
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderLeft: '4px solid transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxSizing: 'border-box'
                    }}>
                        <div>REF / TYPE</div>
                        <div>DETAILS & ROUTE</div>
                        <div>SCHEDULE</div>
                        <div>COST / DIST</div>
                        <div>STATUS</div>
                        <div>ASSIGNMENT / ACTIONS</div>
                    </div>

                    {loading ? (
                        <p style={{ color: 'var(--text-secondary)', padding: '2rem 0' }}>
                            <i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i> Loading orders...
                        </p>
                    ) : unifiedOrders.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', padding: '3rem 0', background: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>
                            No requests found for the selected category and status filter.
                        </p>
                    ) : (
                        unifiedOrders.map(item => {
                            const isAtr = item.type === 'atr';
                            const isPending = item.status === 'Pending';
                            const isApprovedOrAccepted = item.status === 'Approved' || item.status === 'Accepted';
                            const isCompleted = item.status && (item.status.toLowerCase() === 'completed' || item.status.toLowerCase() === 'delivered');
                            const pricing = getCachedPricingRates();
                            const orderActState = resolveOrderActualsState(isAtr ? 'atr' : 'pd', item.rawItem, lockedActualsMap, pricing);
                            const isActualsLocked = orderActState.isLocked;
                            const canRecordActuals = !isActualsLocked && (
                                isCompleted ||
                                (isAtr
                                    ? ['Approved', 'Assigned', 'In Transit'].includes(item.status)
                                    : ['Approved', 'Accepted', 'Scheduled', 'Assigned', 'In Transit'].includes(item.status))
                            );

                            // Check linked delivery/trip table in case rider was assigned there
                            const linkedDel = deliveriesList.find(d => 
                                (d.source_type === item.type || (item.type === 'pd' && d.source_type === 'personal')) && 
                                String(d.source_id) === String(item.rawId)
                            );
                            const riderNicToUse = item.assignedRiderNic || linkedDel?.trip?.rider_nic || linkedDel?.rider_nic;

                            // Find assigned rider from fleet list
                            const assignedRiderObj = ridersList.find(r => 
                                (r.nic && riderNicToUse && String(r.nic).toLowerCase() === String(riderNicToUse).toLowerCase()) ||
                                (r.nic && riderNicToUse && (String(r.nic).endsWith(String(riderNicToUse)) || String(riderNicToUse).endsWith(String(r.nic)))) ||
                                (r.phone && r.phone === riderNicToUse) ||
                                (r.email && r.email === riderNicToUse) ||
                                (r.name && riderNicToUse && String(r.name).toLowerCase() === String(riderNicToUse).toLowerCase())
                            );
                            const riderDisplayName = assignedRiderObj 
                                ? `${assignedRiderObj.name} (${assignedRiderObj.vehicleType} • ${assignedRiderObj.vehicleNumber})`
                                : (riderNicToUse ? `Rider ${riderNicToUse}` : null);

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: ORDER_GRID_COLUMNS,
                                        alignItems: 'center',
                                        gap: '1rem',
                                        padding: '0.9rem 1.25rem',
                                        background: isAtr ? 'rgba(59, 130, 246, 0.03)' : 'rgba(168, 85, 247, 0.03)',
                                        borderRadius: '10px',
                                        border: isAtr ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid rgba(168, 85, 247, 0.15)',
                                        borderLeft: isAtr ? '4px solid #3b82f6' : '4px solid #a855f7',
                                        textAlign: 'left',
                                        transition: 'all 0.2s ease',
                                        boxSizing: 'border-box'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = isAtr ? 'rgba(59, 130, 246, 0.08)' : 'rgba(168, 85, 247, 0.08)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = isAtr ? 'rgba(59, 130, 246, 0.03)' : 'rgba(168, 85, 247, 0.03)'; }}
                                >
                                    {/* Col 1: Reference & Type Badge */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
                                            {item.refNumber}
                                        </span>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                            padding: '0.15rem 0.45rem', borderRadius: '100px', fontSize: '0.7rem', fontWeight: '600', width: 'fit-content',
                                            background: isAtr ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                            color: isAtr ? '#60a5fa' : '#c084fc',
                                            border: isAtr ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)'
                                        }}>
                                            {isAtr ? '✈️ ATR Travel' : '📦 Delivery'}
                                        </span>
                                    </div>

                                    {/* Col 2: Details & Route */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, overflow: 'hidden' }}>
                                        <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.clientTitle}>
                                            {item.clientTitle}
                                        </span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.route}>
                                            📍 {item.route}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.subtitle}>
                                            {item.subtitle}
                                        </span>
                                    </div>

                                    {/* Col 3: Schedule */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: 0, whiteSpace: 'nowrap' }}>
                                        <span style={{ color: '#e5e7eb', fontWeight: '500' }}>📅 {item.schedule.split('@')[0]}</span>
                                        <span>⏰ {item.schedule.split('@')[1] || 'Scheduled'}</span>
                                    </div>

                                    {/* Col 4: Cost / Distance */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: 0, whiteSpace: 'nowrap' }}>
                                        <span style={{ color: '#10b981', fontWeight: '600' }}>Est: {orderActState.estCost} LKR ({orderActState.estDist} km)</span>
                                        {(orderActState.actDist !== null || orderActState.actCost !== null) && (
                                            <span style={{ color: isActualsLocked ? '#10b981' : '#60a5fa', fontSize: '0.72rem', fontWeight: 600 }}>
                                                Act: {orderActState.actCost ?? orderActState.estCost} LKR ({orderActState.actDist ?? orderActState.estDist} km) {isActualsLocked ? '🔒' : ''}
                                            </span>
                                        )}
                                    </div>

                                    {/* Col 5: Status Badge */}
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{
                                            display: 'inline-block', padding: '0.25rem 0.55rem',
                                            background: item.status === 'Approved' || item.status === 'Completed' || item.status === 'Assigned' ? 'rgba(16,185,129,0.1)' : item.status === 'Pending' || item.status === 'Accepted' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: item.status === 'Approved' || item.status === 'Completed' || item.status === 'Assigned' ? 'var(--success)' : item.status === 'Pending' || item.status === 'Accepted' ? '#f59e0b' : 'var(--danger)',
                                            borderRadius: '100px', fontSize: '0.75rem', fontWeight: '600',
                                            border: item.status === 'Approved' || item.status === 'Completed' || item.status === 'Assigned' ? '1px solid rgba(16,185,129,0.2)' : item.status === 'Pending' || item.status === 'Accepted' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(239,68,68,0.2)',
                                            whiteSpace: 'nowrap'
                                        }}>{item.status}</span>
                                    </div>

                                    {/* Col 6: Assignment & Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.45rem', minWidth: 0, width: '100%' }}>
                                        {/* Step 1: Pending -> Accept / Approve */}
                                        {isPending ? (
                                            <button
                                                onClick={() => isAtr ? handleApproveATR(item.rawId) : handleAcceptPD(item.rawId)}
                                                className="primary-btn pulse-effect"
                                                style={{
                                                    width: 'auto',
                                                    padding: '0.4rem 0.8rem',
                                                    height: '32px',
                                                    fontSize: '0.78rem',
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    cursor: 'pointer',
                                                    borderRadius: '6px',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <i className='bx bx-check'></i> {isAtr ? 'Approve ATR' : 'Accept Order'}
                                            </button>
                                        ) : isCompleted && (riderDisplayName || riderNicToUse) ? (
                                            /* Step 2c: Completed Order -> Show Full Rider Details (Name, Phone, Vehicle, NIC) */
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.2rem',
                                                background: 'rgba(16, 185, 129, 0.08)',
                                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '8px',
                                                width: '100%',
                                                maxWidth: '350px',
                                                textAlign: 'left',
                                                boxSizing: 'border-box',
                                                flexShrink: 0
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                                                    <span style={{
                                                        color: '#10b981',
                                                        fontSize: '0.68rem',
                                                        fontWeight: '700',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}>
                                                        <i className='bx bx-check-double' style={{ fontSize: '0.9rem' }}></i> Completed By
                                                    </span>
                                                    {(assignedRiderObj?.nic || riderNicToUse) && (
                                                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                                                            NIC: {assignedRiderObj?.nic || riderNicToUse}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                    <span>👤 {assignedRiderObj?.name || (riderNicToUse ? `Rider ${riderNicToUse}` : 'Completed')}</span>
                                                    {assignedRiderObj?.phone && assignedRiderObj.phone !== 'N/A' && (
                                                        <span style={{ color: '#60a5fa', fontSize: '0.74rem', fontWeight: '500' }}>
                                                            • 📞 {assignedRiderObj.phone}
                                                        </span>
                                                    )}
                                                </div>

                                                {assignedRiderObj?.vehicleType && (
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <span>🚗 {assignedRiderObj.vehicleType}</span>
                                                        <span>•</span>
                                                        <span style={{ color: '#e5e7eb', fontWeight: '600' }}>{assignedRiderObj.vehicleNumber}</span>
                                                        {assignedRiderObj.branch && assignedRiderObj.branch !== 'Main Branch' && (
                                                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>({assignedRiderObj.branch})</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : riderDisplayName ? (
                                            /* Step 2b: Active Rider is already assigned (not completed) */
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.45rem',
                                                background: 'rgba(16, 185, 129, 0.08)',
                                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                                padding: '0.3rem 0.55rem',
                                                borderRadius: '8px',
                                                maxWidth: isAtr ? '240px' : '310px',
                                                flexShrink: 0
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0 }}>
                                                    <span style={{
                                                        color: '#10b981',
                                                        fontSize: '0.68rem',
                                                        fontWeight: '700',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.03em',
                                                        lineHeight: 1.2
                                                    }}>
                                                        Assigned
                                                    </span>
                                                    <span
                                                        style={{
                                                            color: '#fff',
                                                            fontSize: '0.78rem',
                                                            fontWeight: '600',
                                                            lineHeight: 1.2,
                                                            marginTop: '2px'
                                                        }}
                                                        title={riderDisplayName}
                                                    >
                                                        👤 {riderDisplayName}
                                                    </span>
                                                </div>

                                                {!isCompleted && !hasActuals && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isAtr) handleAssignRiderToATR(item.rawId, null);
                                                            else handleAssignRiderToPD(item.rawId, null);
                                                        }}
                                                        style={{
                                                            width: 'auto',
                                                            padding: '0.2rem 0.45rem',
                                                            height: '24px',
                                                            fontSize: '0.68rem',
                                                            fontWeight: '600',
                                                            background: 'rgba(239,68,68,0.12)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239,68,68,0.25)',
                                                            cursor: 'pointer',
                                                            borderRadius: '4px',
                                                            flexShrink: 0,
                                                            lineHeight: 1
                                                        }}
                                                        title="Unassign rider"
                                                    >
                                                        Unassign
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* Step 2a: Request is Approved -> Match & Assign Rider */
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                                <select
                                                    id={`select-staff-rider-${item.id}`}
                                                    defaultValue=""
                                                    style={{
                                                        width: isAtr ? '150px' : '180px',
                                                        maxWidth: '180px',
                                                        padding: '0.35rem 0.5rem',
                                                        background: 'rgba(20, 20, 20, 0.95)',
                                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        borderRadius: '6px',
                                                        color: '#fff',
                                                        fontSize: '0.75rem',
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <option value="" disabled>Select Rider...</option>
                                                    {ridersList.map(r => (
                                                        <option key={r.nic} value={r.nic}>
                                                            {r.name} ({r.vehicleType} • {r.availability})
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        const sel = document.getElementById(`select-staff-rider-${item.id}`);
                                                        if (sel && sel.value) {
                                                            if (isAtr) handleAssignRiderToATR(item.rawId, sel.value);
                                                            else handleAssignRiderToPD(item.rawId, sel.value);
                                                        } else {
                                                            alert('Please select an available rider from the dropdown first.');
                                                        }
                                                    }}
                                                    className="primary-btn"
                                                    style={{
                                                        width: 'auto',
                                                        padding: '0.35rem 0.7rem',
                                                        height: '32px',
                                                        fontSize: '0.75rem',
                                                        background: isAtr ? 'var(--accent-color)' : '#a855f7',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        )}

                                        {/* Trip Actuals: Show for Completed or Active ATR/Private orders until saved & locked */}
                                        {canRecordActuals && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenActualsModal(isAtr ? 'atr' : 'pd', item.rawItem)}
                                                style={{
                                                    width: 'auto',
                                                    padding: '0.35rem 0.65rem',
                                                    height: '32px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0,
                                                    background: orderActState.actDist !== null ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                                                    color: orderActState.actDist !== null ? 'var(--success)' : '#60a5fa',
                                                    border: orderActState.actDist !== null ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(59,130,246,0.25)',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    lineHeight: 1
                                                }}
                                            >
                                                <i className='bx bx-edit-alt'></i> {isCompleted ? 'Enter & Lock Actuals' : 'Actuals'}
                                            </button>
                                        )}
                                        {isActualsLocked && (
                                            <span
                                                title={`Actuals locked${orderActState.lockRecord?.locked_by ? ` by ${orderActState.lockRecord.locked_by}` : ''}`}
                                                style={{
                                                    width: 'auto',
                                                    padding: '0.32rem 0.6rem',
                                                    height: '32px',
                                                    fontSize: '0.73rem',
                                                    fontWeight: '700',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0,
                                                    background: 'rgba(16,185,129,0.12)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16,185,129,0.3)',
                                                    borderRadius: '6px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    lineHeight: 1,
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                <i className='bx bxs-lock-alt'></i> Locked
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Trip / Delivery Actuals Completion & Lock Modal ── */}
            {completingOrder && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }} onClick={() => setCompletingOrder(null)}>
                    <div style={{
                        background: '#18181b', border: '1px solid var(--card-border)', borderRadius: '20px',
                        padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        animation: 'scaleUp 0.3s ease'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className='bx bx-check-circle' style={{ color: 'var(--success)' }}></i>
                                Record &amp; Lock {completingOrder.type === 'atr' ? 'ATR Trip' : 'Private Courier'} Actuals
                            </h3>
                            <button onClick={() => setCompletingOrder(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>
                                <i className='bx bx-x'></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveActuals} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', textAlign: 'left' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <div><strong>Order Ref:</strong> {completingOrder.refLabel}</div>
                                <div><strong>Client / Service:</strong> {completingOrder.titleLabel}</div>
                                <div style={{ color: '#60a5fa' }}>
                                    <strong>Estimated Baseline:</strong> {completingOrder.estDist} km / LKR {Number(completingOrder.estCost || 0).toLocaleString()}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                    Actual Distance Traveled (km) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={actualDistanceInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setActualDistanceInput(val);
                                        if (val !== '' && !Number.isNaN(parseFloat(val))) {
                                            setActualCostInput(
                                                calculateCostFromDistance(completingOrder.type, val, completingOrder.rate, completingOrder.baseFee)
                                            );
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--card-border)', borderRadius: '10px', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                    Actual Billable Cost (LKR) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={actualCostInput}
                                    onChange={(e) => setActualCostInput(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--card-border)', borderRadius: '10px', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ fontSize: '0.78rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                                <i className='bx bxs-lock-alt' style={{ marginRight: '0.35rem' }}></i>
                                Saving will permanently <strong>lock</strong> these actual values and update billing/corporate invoices accordingly.
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                                <button type="button" onClick={() => setCompletingOrder(null)} className="secondary-btn" style={{ padding: '0.65rem 1.25rem', borderRadius: '8px' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={submittingActuals} className="primary-btn" style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', background: 'var(--success)' }}>
                                    {submittingActuals ? 'Saving & Locking...' : 'Save Actuals & Lock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StaffDashboard;
