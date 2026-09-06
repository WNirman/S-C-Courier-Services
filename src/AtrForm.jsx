import React, { useState, useEffect } from 'react';
import logoImg from './assets/favicon.png';
import { supabase } from './supabaseClient';

const DEFAULT_OFFICE = {
    name: 'Colombo Main Office',
    location: 'Colombo, Sri Lanka',
    lat: 6.9271,
    lng: 79.8612
};

const KNOWN_BRANCH_COORDS = {
    'colombo': { lat: 6.9271, lng: 79.8612 },
    'kandy': { lat: 7.2906, lng: 80.6337 },
    'galle': { lat: 6.0535, lng: 80.2210 },
    'jaffna': { lat: 9.6615, lng: 80.0255 },
    'kurunegala': { lat: 7.4863, lng: 80.3623 },
    'gampaha': { lat: 7.0840, lng: 79.9941 },
    'negombo': { lat: 7.2008, lng: 79.8736 },
    'matara': { lat: 5.9549, lng: 80.5550 }
};

const VEHICLE_RATES = {
    'Bike': 50,
    'Three-Wheeler': 75,
    'Car': 110,
    'Van': 150,
    'Lorry': 220
};

function AtrForm({ onBack, loggedInUser }) {
    const [branches, setBranches] = useState([]);
    const [selectedOffice, setSelectedOffice] = useState('Main Office (Colombo)');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
    const [distanceStatus, setDistanceStatus] = useState('');

    // Companies and Departments State
    const [companiesList, setCompaniesList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [loggedInCorporateInfo, setLoggedInCorporateInfo] = useState(null);
    const [userPattern, setUserPattern] = useState(null);
    const [suggestedAtrNumber, setSuggestedAtrNumber] = useState('');
    const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);

    // Helper to parse a reference number into prefix, padding length, and numeric value
    const parseReferencePattern = (refNumber) => {
        if (!refNumber || typeof refNumber !== 'string') return null;
        const trimmed = refNumber.trim();
        // Look for trailing number, e.g. "ABC-2026-005" -> prefix "ABC-2026-", number "005"
        // Or "SLT/EXP/101" -> prefix "SLT/EXP/", number "101"
        // Or "ATR-005" -> prefix "ATR-", number "005"
        const match = trimmed.match(/^(.*?)(\d+)$/);
        if (match && match[1]) {
            return {
                prefix: match[1],
                padLength: Math.max(match[2].length, 3),
                lastNumber: parseInt(match[2], 10),
                fullExample: trimmed
            };
        }
        return {
            prefix: trimmed + '-',
            padLength: 3,
            lastNumber: 0,
            fullExample: trimmed
        };
    };

    // Helper to format raw numbers or input into the customer's established pattern
    const formatAtrNumber = (input, pattern) => {
        if (!input) return '';
        const trimmed = String(input).trim();

        if (pattern && pattern.prefix) {
            // Customer has an established format from their previous ATR!
            // 1. Pure digits (e.g. user types "2" or "42")
            if (/^\d+$/.test(trimmed)) {
                return `${pattern.prefix}${trimmed.padStart(pattern.padLength, '0')}`;
            }

            // 2. If user typed the prefix with number (e.g. lowercase or unpadded)
            const lowerPrefix = pattern.prefix.toLowerCase();
            if (trimmed.toLowerCase().startsWith(lowerPrefix)) {
                const remainder = trimmed.slice(pattern.prefix.length).trim();
                if (/^\d+$/.test(remainder)) {
                    return `${pattern.prefix}${remainder.padStart(pattern.padLength, '0')}`;
                }
            }
            return trimmed;
        }

        // First-time customer without previous format:
        // If they enter pure digits, we can default to ATR-{year}-{padded}
        const currentYear = new Date().getFullYear();
        if (/^\d+$/.test(trimmed)) {
            return `ATR-${currentYear}-${trimmed.padStart(3, '0')}`;
        }
        const atrMatch = trimmed.match(/^ATR[-/ ._]?(\d+)$/i);
        if (atrMatch) {
            return `ATR-${currentYear}-${atrMatch[1].padStart(3, '0')}`;
        }

        return trimmed;
    };

    const isStandardAtrFormat = (val) => {
        if (!val || !val.trim()) return false;
        const trimmed = String(val).trim();
        if (userPattern && userPattern.prefix) {
            return trimmed.toLowerCase().startsWith(userPattern.prefix.toLowerCase()) && trimmed.length > userPattern.prefix.length;
        }
        return /^([A-Za-z0-9_\-\/.\s]{3,})$/.test(trimmed);
    };

    const [formData, setFormData] = useState(() => {
        const saved = localStorage.getItem('atr_form_data');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Error parsing saved ATR form data:", e);
            }
        }
        return {
            atrNumber: '',
            companyId: '',
            department: '',
            requiredDate: '',
            requiredTime: '',
            vehicleType: '',
            purposeOfTravel: '',
            passengerName: '',
            passengerDesignation: '',
            estimatedDistance: '',
            estimatedCost: '',
            actualDistance: '',
            actualCost: '',
            status: 'Pending'
        };
    });

    useEffect(() => {
        localStorage.setItem('atr_form_data', JSON.stringify(formData));
    }, [formData]);

    // Fetch available office branches, companies, and departments from Supabase
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Fetch Branches
                const { data: bData } = await supabase.from('branch').select('*');
                if (bData && bData.length > 0) {
                    setBranches(bData);
                    setSelectedOffice(bData[0].branch_location || 'Main Office (Colombo)');
                }

                // 2. Fetch Companies and check for logged-in corporate customer
                let corporateProfile = null;
                let userCompId = null;

                if (loggedInUser) {
                    try {
                        const { data: custData } = await supabase
                            .from('customer')
                            .select('*')
                            .eq('cust_email', loggedInUser)
                            .single();
                        
                        if (custData) {
                            // Extract company name if in format "Name (Company)" or if cust_type === 'Corporate'
                            let compNameExtracted = '';
                            const match = custData.cust_name?.match(/\(([^)]+)\)/);
                            if (match) compNameExtracted = match[1];

                            if (custData.cust_type === 'Corporate' || compNameExtracted) {
                                const { data: foundComp } = await supabase
                                    .from('company')
                                    .select('*')
                                    .or(`comp_name.ilike.%${compNameExtracted || custData.cust_name}%,comp_address.eq.${custData.cust_address}`);

                                if (foundComp && foundComp.length > 0) {
                                    corporateProfile = foundComp[0];
                                    userCompId = String(foundComp[0].comp_id);
                                } else {
                                    corporateProfile = {
                                        comp_id: null,
                                        comp_name: compNameExtracted || custData.cust_name,
                                        comp_address: custData.cust_address || 'Corporate Headquarters',
                                        comp_phoneno: custData.cust_phoneno
                                    };
                                }
                            }
                        }
                    } catch (cErr) {
                        console.warn('Note finding user corporate profile:', cErr);
                    }
                }

                if (corporateProfile) {
                    setLoggedInCorporateInfo(corporateProfile);
                    if (corporateProfile.comp_address && corporateProfile.comp_address !== 'N/A') {
                        setSelectedOffice(`${corporateProfile.comp_name} (${corporateProfile.comp_address})`);
                    }
                }

                const { data: compData } = await supabase.from('company').select('*');
                if (compData && compData.length > 0) {
                    setCompaniesList(compData);
                    const defaultComp = userCompId || String(compData[0].comp_id);
                    setSelectedCompanyId(defaultComp);
                    setFormData(prev => ({ ...prev, companyId: prev.companyId || defaultComp }));
                }

                // 3. Fetch Departments
                const { data: deptData } = await supabase.from('department').select('*');
                if (deptData && deptData.length > 0) {
                    setDepartmentsList(deptData);
                    if (!formData.department) {
                        setFormData(prev => ({ ...prev, department: String(deptData[0].dep_id) }));
                    }
                }

                // 4. Fetch User's Learned ATR Reference Pattern from previous submissions
                await fetchUserAtrPattern();
            } catch (err) {
                console.error('Error fetching initial form data:', err);
            }
        };
        fetchInitialData();
    }, [loggedInUser]);

    const fetchUserAtrPattern = async () => {
        try {
            let patternFound = null;
            let nextSuggested = '';

            if (loggedInUser) {
                // Check previous ATR records submitted by this customer
                const { data: userAtrs } = await supabase
                    .from('atr')
                    .select('atr_number, atr_id')
                    .eq('cust_email', loggedInUser)
                    .order('atr_id', { ascending: false })
                    .limit(20);

                if (userAtrs && userAtrs.length > 0) {
                    const latestRef = userAtrs[0].atr_number;
                    const parsed = parseReferencePattern(latestRef);
                    if (parsed) {
                        let maxNum = parsed.lastNumber || 0;
                        userAtrs.forEach(item => {
                            if (item.atr_number && item.atr_number.startsWith(parsed.prefix)) {
                                const numPart = item.atr_number.slice(parsed.prefix.length);
                                const n = parseInt(numPart, 10);
                                if (!isNaN(n) && n > maxNum) maxNum = n;
                            }
                        });
                        const nextNum = maxNum + 1;
                        nextSuggested = `${parsed.prefix}${String(nextNum).padStart(parsed.padLength, '0')}`;
                        patternFound = parsed;
                    }
                }

                // Fallback to local storage if needed
                if (!patternFound) {
                    const savedPat = localStorage.getItem(`atr_user_pattern_${loggedInUser}`);
                    if (savedPat) {
                        try {
                            const parsed = JSON.parse(savedPat);
                            if (parsed && parsed.prefix) {
                                patternFound = parsed;
                                nextSuggested = `${parsed.prefix}${String((parsed.lastNumber || 0) + 1).padStart(parsed.padLength || 3, '0')}`;
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            }

            if (patternFound) {
                setUserPattern(patternFound);
                setSuggestedAtrNumber(nextSuggested);
                setIsFirstTimeUser(false);
            } else {
                setUserPattern(null);
                setSuggestedAtrNumber('');
                setIsFirstTimeUser(true);
            }
        } catch (err) {
            console.warn('Error calculating user ATR format pattern:', err);
        }
    };

    const handleApplyAtrSuggestion = (value) => {
        if (value) {
            setFormData(prev => ({ ...prev, atrNumber: value }));
        }
    };

    const handleAtrBlur = () => {
        if (formData.atrNumber && formData.atrNumber.trim()) {
            const formatted = formatAtrNumber(formData.atrNumber, userPattern);
            if (formatted && formatted !== formData.atrNumber) {
                setFormData(prev => ({ ...prev, atrNumber: formatted }));
            }
        }
    };

    const handleAtrKeyDown = (e) => {
        if (e.key === 'Enter') {
            const formatted = formatAtrNumber(formData.atrNumber, userPattern);
            if (formatted && formatted !== formData.atrNumber) {
                e.preventDefault();
                setFormData(prev => ({ ...prev, atrNumber: formatted }));
            }
        }
    };


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            // If vehicle type changed and estimatedDistance is present, auto-update estimated cost
            if (name === 'vehicleType' && updated.estimatedDistance && !isNaN(parseFloat(updated.estimatedDistance))) {
                const rate = VEHICLE_RATES[value] || 100;
                updated.estimatedCost = (parseFloat(updated.estimatedDistance) * rate).toFixed(2);
            }
            return updated;
        });
    };

    // Geocode helper
    const getCoordinates = async (queryText, defaultCoords) => {
        const lower = queryText.toLowerCase();
        for (const [key, coords] of Object.entries(KNOWN_BRANCH_COORDS)) {
            if (lower.includes(key)) return coords;
        }
        try {
            const q = queryText.toLowerCase().includes('sri lanka') ? queryText : `${queryText}, Sri Lanka`;
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    displayName: data[0].display_name.split(',')[0]
                };
            }
        } catch (err) {
            console.error('Geocoding error:', err);
        }
        return defaultCoords;
    };

    // Calculate distance from the chosen Starting Office Location to Destination
    const handleCalculateDistance = async (customAddress) => {
        const addressToSearch = customAddress !== undefined ? customAddress : destinationAddress;
        if (!addressToSearch || !addressToSearch.trim()) {
            setDistanceStatus('Please enter a destination place or address first.');
            return;
        }

        setIsCalculatingDistance(true);
        setDistanceStatus('Locating starting office & destination...');

        try {
            // 1. Get Origin Office Coordinates
            const officeCoords = await getCoordinates(selectedOffice, DEFAULT_OFFICE);

            // 2. Geocode Destination
            const destCoords = await getCoordinates(addressToSearch, null);

            if (!destCoords) {
                setDistanceStatus('Destination place not found. You can enter the distance manually.');
                setIsCalculatingDistance(false);
                return;
            }

            setDistanceStatus('Calculating driving route from office...');

            // 3. Calculate driving route distance using OSRM
            const routeRes = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${officeCoords.lng},${officeCoords.lat};${destCoords.lng},${destCoords.lat}?overview=false`
            );
            const routeData = await routeRes.json();

            if (routeData && routeData.routes && routeData.routes.length > 0) {
                const distanceKm = (routeData.routes[0].distance / 1000).toFixed(2);
                const rate = VEHICLE_RATES[formData.vehicleType] || 100;
                const cost = (parseFloat(distanceKm) * rate).toFixed(2);

                setFormData(prev => ({
                    ...prev,
                    estimatedDistance: distanceKm,
                    estimatedCost: cost
                }));

                const destName = destCoords.displayName || addressToSearch;
                setDistanceStatus(`✓ ${distanceKm} km from [${selectedOffice}] to [${destName}]`);
            } else {
                // Fallback Haversine straight line
                const R = 6371; // km
                const dLat = (destCoords.lat - officeCoords.lat) * Math.PI / 180;
                const dLon = (destCoords.lng - officeCoords.lng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(officeCoords.lat * Math.PI / 180) * Math.cos(destCoords.lat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const estKm = (R * c * 1.3).toFixed(2);

                const rate = VEHICLE_RATES[formData.vehicleType] || 100;
                setFormData(prev => ({
                    ...prev,
                    estimatedDistance: estKm,
                    estimatedCost: (parseFloat(estKm) * rate).toFixed(2)
                }));
                setDistanceStatus(`✓ Approx. ${estKm} km from [${selectedOffice}]`);
            }
        } catch (err) {
            console.error('Error fetching distance from OpenStreetMap:', err);
            setDistanceStatus('Unable to auto-calculate. You can enter distance manually.');
        } finally {
            setIsCalculatingDistance(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        const formattedAtr = formatAtrNumber(formData.atrNumber, userPattern) || formData.atrNumber;
        console.log('ATR Form Submitted:', { ...formData, atrNumber: formattedAtr });

        try {
            const insertData = {
                dep_id: parseInt(formData.department),
                atr_number: formattedAtr,
                required_date: formData.requiredDate,
                required_time: formData.requiredTime,
                vehicle_type: formData.vehicleType,
                purpose_of_travel: formData.purposeOfTravel + (destinationAddress ? ` (Destination: ${destinationAddress})` : ''),
                principal_passenger_name: formData.passengerName,
                principal_passenger_designation: formData.passengerDesignation,
                estimated_distance: parseFloat(formData.estimatedDistance),
                estimated_cost: parseFloat(formData.estimatedCost),
                actual_distance: formData.actualDistance ? parseFloat(formData.actualDistance) : null,
                actual_cost: formData.actualCost ? parseFloat(formData.actualCost) : null,
                status: 'Pending',
                approved_by: null,
                approval_date: null,
                approval_token: null,
                client_approver_id: null,
                cust_email: loggedInUser
            };

            const { error } = await supabase.from('atr').insert(insertData);
            if (error) throw error;

            // Remember the format pattern from this submission for future ATR requests
            if (formattedAtr && loggedInUser) {
                const parsed = parseReferencePattern(formattedAtr);
                if (parsed) {
                    localStorage.setItem(`atr_user_pattern_${loggedInUser}`, JSON.stringify(parsed));
                    setUserPattern(parsed);
                }
            }

            alert('Your ATR request has been submitted successfully!');
            localStorage.removeItem('atr_form_data');
            handleReset();
            if (onBack) onBack();
        } catch (err) {
            console.error('Error submitting ATR request:', err);
            alert('Failed to submit ATR request: ' + err.message);
        }
    };

    const handleReset = () => {
        setFormData({
            atrNumber: '',
            department: '',
            requiredDate: '',
            requiredTime: '',
            vehicleType: '',
            purposeOfTravel: '',
            passengerName: '',
            passengerDesignation: '',
            estimatedDistance: '',
            estimatedCost: '',
            actualDistance: '',
            actualCost: '',
            status: 'Pending'
        });
        setDestinationAddress('');
        setDistanceStatus('');
        localStorage.removeItem('atr_form_data');
        fetchUserAtrPattern();
    };

    const formattedAtrPreview = formatAtrNumber(formData.atrNumber, userPattern);
    const showAutoFormatSuggestion = Boolean(formData.atrNumber && formData.atrNumber.trim() && formattedAtrPreview !== formData.atrNumber.trim());
    const isAtrValid = isStandardAtrFormat(formData.atrNumber);

    return (
        <div className="atr-page">
            <div className="atr-split-layout">
                <div className="atr-left-panel">
                    <div className="atr-left-content">
                        <div className="atr-left-logo" onClick={onBack} style={{ cursor: 'pointer' }}>
                            <img src={logoImg} alt="SC Courier" />
                            <span>SC Courier</span>
                        </div>

                        <h2>Welcome to <br /><span className="atr-highlight">Transport Request</span></h2>
                        <p>Submit and manage your vehicle authorization requests. Fill in the details to submit your request directly to dispatch.</p>

                        <div className="atr-lottie-container">
                            <lottie-player
                                src="/src/assets/Delivery.json"
                                background="transparent"
                                speed="1"
                                loop
                                autoplay
                            ></lottie-player>
                        </div>
                    </div>
                </div>

                <div className="atr-right-panel">
                    <div className="atr-form-header">
                        <h1><i className='bx bx-car'></i> Authorization To Request</h1>
                        <p>Please provide below details to create a transport request</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="atr-section-title">
                            <i className='bx bx-buildings'></i> Corporate Client Entity & Information
                        </div>

                        {loggedInCorporateInfo ? (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
                                border: '1px solid rgba(168, 85, 247, 0.35)',
                                padding: '1.15rem',
                                borderRadius: '14px',
                                marginBottom: '1.25rem',
                                display: 'flex',
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.4rem',
                                        color: '#fff',
                                        flexShrink: 0
                                    }}>
                                        <i className='bx bx-buildings'></i>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Requesting Corporate Entity
                                        </div>
                                        <h3 style={{ margin: '0.1rem 0', color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                                            {loggedInCorporateInfo.comp_name}
                                        </h3>
                                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                            <i className='bx bx-map-pin' style={{ marginRight: '3px', color: 'var(--accent-color)' }}></i>
                                            {loggedInCorporateInfo.comp_address}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '0.3rem 0.75rem', borderRadius: '100px', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <i className='bx bx-check-shield'></i> Registered Corporate Client
                                </div>
                            </div>
                        ) : null}

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Department <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-buildings'></i>
                                    <select name="department" value={formData.department} onChange={handleChange} required>
                                        <option value="" disabled>Select Department</option>
                                        {departmentsList.length > 0 ? (
                                            departmentsList.map(d => (
                                                <option key={d.dep_id} value={d.dep_id}>{d.dep_name}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="1">Operations</option>
                                                <option value="2">Finance</option>
                                                <option value="3">Human Resources</option>
                                                <option value="4">Logistics</option>
                                                <option value="5">Administration</option>
                                                <option value="6">IT</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="atr-form-group atr-ref-form-group">
                                <div className="atr-label-row">
                                    <label>ATR Reference Number <span className="required">*</span></label>
                                    {formData.atrNumber && formData.atrNumber.trim() ? (
                                        isAtrValid ? (
                                            <span className="atr-ref-valid-badge">
                                                <i className='bx bx-check-circle'></i> Valid Format
                                            </span>
                                        ) : !showAutoFormatSuggestion ? (
                                            <span className="atr-ref-invalid-badge">
                                                <i className='bx bx-info-circle'></i> {userPattern ? `Expected: ${userPattern.prefix}XXX` : 'Custom Format'}
                                            </span>
                                        ) : null
                                    ) : userPattern ? (
                                        <span className="atr-ref-pattern-badge" title={`Format: ${userPattern.prefix}XXX`}>
                                            <i className='bx bx-check-shield'></i> Saved Format: {userPattern.prefix}XXX
                                        </span>
                                    ) : null}
                                </div>
                                <div className={`atr-input-with-icon ${showAutoFormatSuggestion ? 'atr-input-with-addon' : ''}`}>
                                    <i className='bx bx-hash'></i>
                                    <input 
                                        type="text" 
                                        name="atrNumber" 
                                        value={formData.atrNumber} 
                                        onChange={handleChange}
                                        onBlur={handleAtrBlur}
                                        onKeyDown={handleAtrKeyDown}
                                        placeholder={userPattern ? `e.g. ${suggestedAtrNumber || `${userPattern.prefix}002`}` : "e.g. ABC-2026-001"} 
                                        required 
                                        maxLength="50" 
                                    />
                                    {showAutoFormatSuggestion && (
                                        <button 
                                            type="button" 
                                            className="atr-input-addon-btn format-active"
                                            onClick={() => handleApplyAtrSuggestion(formattedAtrPreview)}
                                            title="Click to apply format"
                                        >
                                            <i className='bx bx-magic-wand'></i> Format
                                        </button>
                                    )}
                                </div>

                                {/* Suggestion & Auto-format Chips */}
                                {(!formData.atrNumber && suggestedAtrNumber) || showAutoFormatSuggestion ? (
                                    <div className="atr-ref-suggestions">
                                        {!formData.atrNumber && suggestedAtrNumber && (
                                            <button
                                                type="button"
                                                className="atr-ref-chip-btn"
                                                onClick={() => handleApplyAtrSuggestion(suggestedAtrNumber)}
                                                title="Click to apply next reference number in sequence"
                                            >
                                                <i className='bx bx-history' style={{ color: '#60a5fa' }}></i>
                                                <span>Next reference: <strong>{suggestedAtrNumber}</strong></span>
                                                <span className="atr-ref-chip-action">Use <i className='bx bx-plus'></i></span>
                                            </button>
                                        )}

                                        {showAutoFormatSuggestion && (
                                            <button
                                                type="button"
                                                className="atr-ref-chip-btn highlight"
                                                onClick={() => handleApplyAtrSuggestion(formattedAtrPreview)}
                                                title="Click to apply format"
                                            >
                                                <i className='bx bx-magic-wand' style={{ color: '#c084fc' }}></i>
                                                <span>Auto-format as: <strong>{formattedAtrPreview}</strong></span>
                                                <span className="atr-ref-chip-action">Apply <i className='bx bx-check'></i></span>
                                            </button>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="atr-section-title">
                            <i className='bx bx-calendar'></i> Schedule & Vehicle
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Required Date <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-calendar-event'></i>
                                    <input type="date" name="requiredDate" value={formData.requiredDate} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Required Time <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-time-five'></i>
                                    <input type="time" name="requiredTime" value={formData.requiredTime} onChange={handleChange} required />
                                </div>
                            </div>
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Vehicle Type <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-car'></i>
                                    <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} required>
                                        <option value="" disabled>Select Vehicle Type</option>
                                        <option value="Van">Van</option>
                                        <option value="Lorry">Lorry</option>
                                        <option value="Bike">Motorbike</option>
                                        <option value="Three-Wheeler">Three-Wheeler</option>
                                        <option value="Car">Car</option>
                                    </select>
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Purpose of Travel <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-detail'></i>
                                    <input type="text" name="purposeOfTravel" value={formData.purposeOfTravel} onChange={handleChange} placeholder="e.g. Document Delivery, Site Visit" required maxLength="255" />
                                </div>
                            </div>
                        </div>

                        <div className="atr-section-title">
                            <i className='bx bx-user'></i> Passenger Details
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Principal Passenger Name <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-user-circle'></i>
                                    <input type="text" name="passengerName" value={formData.passengerName} onChange={handleChange} placeholder="e.g. S. Fernando" required maxLength="100" />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Designation <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-briefcase'></i>
                                    <input type="text" name="passengerDesignation" value={formData.passengerDesignation} onChange={handleChange} placeholder="e.g. Operations Manager" required maxLength="100" />
                                </div>
                            </div>
                        </div>

                        <div className="atr-section-title">
                            <i className='bx bx-calculator'></i> Destination & Distance Estimation
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Starting Office Location <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-building-house'></i>
                                    <select 
                                        value={selectedOffice} 
                                        onChange={(e) => {
                                            setSelectedOffice(e.target.value);
                                            setDistanceStatus('');
                                        }}
                                    >
                                        {branches.length > 0 ? (
                                            branches.map(b => (
                                                <option key={b.branch_id} value={b.branch_location}>{b.branch_location}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="Main Office (Colombo)">Main Office (Colombo)</option>
                                                <option value="Kandy Branch">Kandy Branch</option>
                                                <option value="Galle Branch">Galle Branch</option>
                                                <option value="Negombo Branch">Negombo Branch</option>
                                                <option value="Kurunegala Branch">Kurunegala Branch</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="atr-form-group">
                                <label>Destination Place / City / Address</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div className="atr-input-with-icon" style={{ flex: 1 }}>
                                        <i className='bx bx-map-pin'></i>
                                        <input
                                            type="text"
                                            value={destinationAddress}
                                            onChange={(e) => {
                                                setDestinationAddress(e.target.value);
                                                setDistanceStatus('');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleCalculateDistance();
                                                }
                                            }}
                                            placeholder="e.g. Kandy, Galle, Nugegoda, Negombo..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCalculateDistance()}
                                        disabled={isCalculatingDistance || !destinationAddress.trim()}
                                        style={{
                                            padding: '0 1.2rem',
                                            background: 'var(--accent-color)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '10px',
                                            cursor: isCalculatingDistance || !destinationAddress.trim() ? 'not-allowed' : 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.88rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            opacity: isCalculatingDistance || !destinationAddress.trim() ? 0.6 : 1,
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {isCalculatingDistance ? (
                                            <><i className='bx bx-loader-alt bx-spin'></i> Calculating...</>
                                        ) : (
                                            <><i className='bx bx-radar'></i> Get Distance</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {distanceStatus && (
                            <div style={{
                                fontSize: '0.82rem',
                                marginBottom: '1rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                background: distanceStatus.startsWith('✓') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                border: distanceStatus.startsWith('✓') ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--card-border)',
                                color: distanceStatus.startsWith('✓') ? 'var(--success)' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                <i className={distanceStatus.startsWith('✓') ? 'bx bx-check-circle' : 'bx bx-info-circle'}></i>
                                {distanceStatus}
                            </div>
                        )}


                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Estimated Distance (km) <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-map-alt'></i>
                                    <input
                                        type="number"
                                        name="estimatedDistance"
                                        value={formData.estimatedDistance}
                                        onChange={handleChange}
                                        placeholder="e.g. 25.50"
                                        step="0.01"
                                        min="0"
                                        max="999999.99"
                                        required
                                    />
                                </div>
                                <div className="atr-input-hint">Auto-filled via destination or type manually</div>
                            </div>
                            <div className="atr-form-group">
                                <label>Estimated Cost (LKR) <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-money'></i>
                                    <input
                                        type="number"
                                        name="estimatedCost"
                                        value={formData.estimatedCost}
                                        onChange={handleChange}
                                        placeholder="e.g. 1500.00"
                                        step="0.01"
                                        min="0"
                                        max="99999999.99"
                                        required
                                    />
                                </div>
                                <div className="atr-input-hint">Auto-calculated or enter manually</div>
                            </div>
                        </div>

                        <div className="atr-section-title">
                            <i className='bx bx-check-double'></i> Actual Cost & Distance
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Actual Distance (km)</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-map-alt'></i>
                                    <input
                                        type="text"
                                        name="actualDistance"
                                        value={formData.actualDistance || ''}
                                        placeholder="To be recorded upon trip completion"
                                        disabled
                                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                    />
                                </div>
                                <div className="atr-input-hint">Fetched from rider's trip record & verified by Staff/Admin</div>
                            </div>
                            <div className="atr-form-group">
                                <label>Actual Cost (LKR)</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-money'></i>
                                    <input
                                        type="text"
                                        name="actualCost"
                                        value={formData.actualCost || ''}
                                        placeholder="To be calculated upon trip completion"
                                        disabled
                                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                    />
                                </div>
                                <div className="atr-input-hint">Calculated based on actual distance traveled</div>
                            </div>
                        </div>

                        <div className="atr-form-actions-bar">
                            <button type="button" className="atr-btn atr-btn-secondary" onClick={handleReset}>
                                <i className='bx bx-reset'></i> Reset
                            </button>
                            <button type="submit" className="atr-btn atr-btn-primary">
                                <i className='bx bx-send'></i> Submit Request
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AtrForm;
