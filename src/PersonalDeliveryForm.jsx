import React, { useState, useEffect, useRef } from 'react';
import logoImg from './assets/favicon.png';
import { supabase } from './supabaseClient';
import LocationPickerModal from './LocationPickerModal';
import { useMapProvider, nominatimSearch } from './mapProvider';

function PersonalDeliveryForm({ onBack, loggedInUser }) {
    const emptyForm = {
        requestedDate:  '',
        requestedTime:  '',
        pickupAddress:  '',
        pickupLat:      null,
        pickupLng:      null,
        dropAddress:    '',
        dropLat:        null,
        dropLng:        null,
        itemType:       '',
        itemWeight:     '',
        itemDescription:'',
        senderName:     '',
        senderPhone:    '',
        receiverName:   '',
        receiverPhone:  '',
        receiverNic:    '',
    };

    const [formData,     setFormData]     = useState(() => {
        const saved = localStorage.getItem('pd_form_data');
        if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
        return emptyForm;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Map modal
    const [mapModal, setMapModal] = useState({ open: false, field: null });

    const provider = useMapProvider();   // 'loading' | 'google' | 'osm'

    // OpenStreetMap (Nominatim) suggestions – used only when Google is unavailable
    const [pickupSug, setPickupSug] = useState([]);
    const [dropSug,   setDropSug]   = useState([]);
    const pickupDebounce = useRef(null);
    const dropDebounce   = useRef(null);

    // Refs for Google Places Autocomplete inputs
    const pickupInputRef = useRef(null);
    const dropInputRef   = useRef(null);
    const pickupAcRef    = useRef(null);  // Autocomplete instance
    const dropAcRef      = useRef(null);

    // ── Auto-fill sender from Supabase ───────────────────────────────────────
    useEffect(() => {
        if (loggedInUser) {
            supabase
                .from('customer')
                .select('cust_name, cust_phoneno')
                .eq('cust_email', loggedInUser)
                .single()
                .then(({ data }) => {
                    if (data) {
                        setFormData(prev => ({
                            ...prev,
                            senderName:  prev.senderName  || data.cust_name    || '',
                            senderPhone: prev.senderPhone || data.cust_phoneno || '',
                        }));
                    }
                });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loggedInUser]);

    // ── Persist to localStorage ──────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem('pd_form_data', JSON.stringify(formData));
    }, [formData]);

    // ── Attach Google Places Autocomplete to address inputs ──────────────────
    useEffect(() => {
        if (provider !== 'google') {
            // Google unavailable → remove any leftover Google dropdowns / listeners
            [pickupAcRef, dropAcRef].forEach((r) => {
                if (r.current) { window.google?.maps?.event?.clearInstanceListeners(r.current); r.current = null; }
            });
            if (provider === 'osm') document.querySelectorAll('.pac-container').forEach((el) => el.remove());
            return;
        }
        let mounted = true;
        (async () => {
            if (!mounted || !window.google?.maps?.places) return;
            const G = window.google.maps.places;

            // Pickup autocomplete
            if (pickupInputRef.current && !pickupAcRef.current) {
                const ac = new G.Autocomplete(pickupInputRef.current, {
                    componentRestrictions: { country: 'lk' },
                    fields: ['geometry', 'formatted_address', 'name'],
                });
                pickupAcRef.current = ac;
                ac.addListener('place_changed', () => {
                    const place = ac.getPlace();
                    if (!place.geometry?.location) return;
                    const lat  = place.geometry.location.lat();
                    const lng  = place.geometry.location.lng();
                    const addr = place.formatted_address || place.name || '';
                    setFormData(prev => ({ ...prev, pickupAddress: addr, pickupLat: lat, pickupLng: lng }));
                });
            }

            // Drop autocomplete
            if (dropInputRef.current && !dropAcRef.current) {
                const ac = new G.Autocomplete(dropInputRef.current, {
                    componentRestrictions: { country: 'lk' },
                    fields: ['geometry', 'formatted_address', 'name'],
                });
                dropAcRef.current = ac;
                ac.addListener('place_changed', () => {
                    const place = ac.getPlace();
                    if (!place.geometry?.location) return;
                    const lat  = place.geometry.location.lat();
                    const lng  = place.geometry.location.lng();
                    const addr = place.formatted_address || place.name || '';
                    setFormData(prev => ({ ...prev, dropAddress: addr, dropLat: lat, dropLng: lng }));
                });
            }
        })();
        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider]);

    // ── Map modal confirm ─────────────────────────────────────────────────────
    const handleMapConfirm = ({ address, lat, lng }) => {
        if (mapModal.field === 'pickup') {
            setFormData(prev => ({ ...prev, pickupAddress: address, pickupLat: lat, pickupLng: lng }));
            if (pickupInputRef.current) pickupInputRef.current.value = address;
        } else {
            setFormData(prev => ({ ...prev, dropAddress: address, dropLat: lat, dropLng: lng }));
            if (dropInputRef.current) dropInputRef.current.value = address;
        }
    };

    // ── Generic change handler ────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePickupInputChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, pickupAddress: val, pickupLat: null, pickupLng: null }));
        if (provider !== 'google') {
            clearTimeout(pickupDebounce.current);
            if (val.trim().length < 2) { setPickupSug([]); return; }
            pickupDebounce.current = setTimeout(async () => {
                try { setPickupSug((await nominatimSearch(val)) || []); } catch { /* ignore */ }
            }, 350);
        }
    };

    const handleDropInputChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, dropAddress: val, dropLat: null, dropLng: null }));
        if (provider !== 'google') {
            clearTimeout(dropDebounce.current);
            if (val.trim().length < 2) { setDropSug([]); return; }
            dropDebounce.current = setTimeout(async () => {
                try { setDropSug((await nominatimSearch(val)) || []); } catch { /* ignore */ }
            }, 350);
        }
    };

    const pickSuggestion = (field, item) => {
        const lat = parseFloat(item.lat), lng = parseFloat(item.lng ?? item.lon);
        if (field === 'pickup') {
            setFormData(prev => ({ ...prev, pickupAddress: item.display_name, pickupLat: lat, pickupLng: lng }));
            setPickupSug([]);
        } else {
            setFormData(prev => ({ ...prev, dropAddress: item.display_name, dropLat: lat, dropLng: lng }));
            setDropSug([]);
        }
    };

    const handleReset = () => {
        setFormData(emptyForm);
        setPickupSug([]); setDropSug([]);
        if (pickupInputRef.current) pickupInputRef.current.value = '';
        if (dropInputRef.current)   dropInputRef.current.value   = '';
        localStorage.removeItem('pd_form_data');
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const insertData = {
                cust_email:        loggedInUser,
                pickup_address:    formData.pickupAddress.trim(),
                pickup_lat:        formData.pickupLat   ?? null,
                pickup_lng:        formData.pickupLng   ?? null,
                drop_address:      formData.dropAddress.trim(),
                drop_lat:          formData.dropLat     ?? null,
                drop_lng:          formData.dropLng     ?? null,
                item_type:         formData.itemType,
                item_weight:       formData.itemWeight.trim()      || null,
                item_description:  formData.itemDescription.trim() || null,
                sender_name:       formData.senderName.trim(),
                sender_phone:      formData.senderPhone.trim(),
                receiver_name:     formData.receiverName.trim(),
                receiver_phone:    formData.receiverPhone.trim(),
                receiver_nic:      formData.receiverNic.trim()     || null,
                status:            'Pending',
                requested_date:    formData.requestedDate,
                requested_time:    formData.requestedTime,
            };

            let success = false;

            // 1. Supabase insert
            try {
                const { error } = await supabase.from('personal_delivery').insert(insertData);
                if (!error) success = true;
                else console.warn('Supabase insert error:', error.message);
            } catch (sbErr) {
                console.warn('Supabase exception:', sbErr);
            }

            // 2. Express backend fallback
            if (!success) {
                try {
                    const res = await fetch('http://localhost:5000/api/personal-delivery/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(insertData),
                    });
                    const ct = res.headers.get('content-type') || '';
                    if (res.ok && ct.includes('application/json')) {
                        const d = await res.json();
                        if (d.success) success = true;
                    }
                } catch (fetchErr) {
                    console.warn('Backend unreachable:', fetchErr);
                }
            }

            // 3. LocalStorage last resort
            if (!success) {
                const local = JSON.parse(localStorage.getItem('local_personal_deliveries') || '[]');
                local.unshift({ pd_id: Date.now(), ...insertData, created_at: new Date().toISOString() });
                localStorage.setItem('local_personal_deliveries', JSON.stringify(local));
                success = true;
            }

            alert('Your personal delivery request has been submitted successfully!');
            handleReset();
            if (onBack) onBack();
        } catch (err) {
            console.error('Submission error:', err);
            alert('Failed to submit request: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Reusable location field ───────────────────────────────────────────────
    // NOTE: a render function (not a component) so inputs are not remounted on every keystroke
    const renderLocationField = ({ label, inputRef, value, onChange, placeholder, lat, lng, mapField, icon, suggestions }) => (
        <div className="atr-form-group" style={{ position: 'relative' }}>
            <label>{label} <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <div className="atr-input-with-icon" style={{ flex: 1 }}>
                    <i className={`bx ${icon}`}></i>
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={onChange}
                        onBlur={() => setTimeout(() => (mapField === 'pickup' ? setPickupSug([]) : setDropSug([])), 200)}
                        placeholder={placeholder}
                        required
                        maxLength="400"
                        autoComplete="off"
                    />
                </div>
                {/* Pin on Map button */}
                <button
                    type="button"
                    onClick={() => setMapModal({ open: true, field: mapField })}
                    title="Pin on map"
                    style={{
                        padding: '0 1rem',
                        background:   lat ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.10)',
                        border:       `1px solid ${lat ? 'rgba(16,185,129,0.4)' : 'rgba(249,115,22,0.35)'}`,
                        borderRadius: '10px',
                        color:        lat ? 'var(--success)' : 'var(--accent-color)',
                        cursor:       'pointer',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          '0.35rem',
                        fontSize:     '0.82rem',
                        fontWeight:   600,
                        whiteSpace:   'nowrap',
                        transition:   'all 0.2s ease',
                        flexShrink:   0,
                    }}
                >
                    <i className={`bx ${lat ? 'bx-check-circle' : 'bxs-map-pin'}`}></i>
                    {lat ? 'Pinned ✓' : 'Pin Map'}
                </button>
            </div>

            {/* Autocomplete dropdown */}
            {suggestions && suggestions.length > 0 && (
                <ul className="loc-suggestions loc-suggestions-inline">
                    {suggestions.map((item) => (
                        <li key={item.place_id} onMouseDown={() => pickSuggestion(mapField, item)}>
                            <i className='bx bx-map-pin'></i><span>{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}

            {/* Coordinates badge */}
            {lat && lng ? (
                <div className="atr-input-hint" style={{ color: 'var(--success)' }}>
                    <i className='bx bx-check-circle' style={{ marginRight: '4px' }}></i>
                    Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)} — coordinates saved
                </div>
            ) : (
                <div className="atr-input-hint">
                    <i className='bx bxs-map-pin' style={{ marginRight: '4px', color: 'var(--accent-color)' }}></i>
                    Type to search place/address or click <strong>Pin Map</strong>
                </div>
            )}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="atr-page">
            <div className="atr-split-layout">

                {/* ── Left Panel ── */}
                <div className="atr-left-panel">
                    <div className="atr-left-content">
                        <div className="atr-left-logo" onClick={onBack} style={{ cursor: 'pointer' }}>
                            <img src={logoImg} alt="SC Courier" />
                            <span>SC Courier</span>
                        </div>

                        <h2>Personal <br /><span className="atr-highlight">Delivery</span></h2>
                        <p>
                            Send packages quickly and reliably. Fill in the pickup and
                            drop details along with receiver information to book your
                            personal courier request.
                        </p>

                        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[
                                { icon: 'bx-map-pin',      text: 'Door-to-door pickup & delivery' },
                                { icon: 'bx-package',      text: 'Documents, parcels & fragile items' },
                                { icon: 'bx-shield-check', text: 'Tracked & insured handling' },
                                { icon: 'bx-time-five',    text: 'Real-time status updates' },
                            ].map(({ icon, text }) => (
                                <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: 'rgba(249,115,22,0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <i className={`bx ${icon}`} style={{ color: 'var(--accent-color)', fontSize: '1.1rem' }} />
                                    </div>
                                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Right Panel ── */}
                <div className="atr-right-panel">
                    <div className="atr-form-header">
                        <h1><i className='bx bx-package'></i> Personal Delivery Request</h1>
                        <p>Provide the details below to book your delivery</p>
                    </div>

                    <form onSubmit={handleSubmit}>

                        {/* ── Schedule ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-calendar-check'></i> Delivery Schedule
                        </div>
                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Pickup Date <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-calendar'></i>
                                    <input
                                        type="date" name="requestedDate"
                                        value={formData.requestedDate} onChange={handleChange}
                                        onClick={(e) => { try { e.target.showPicker(); } catch (_) {} }}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Pickup Time <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-time'></i>
                                    <input
                                        type="time" name="requestedTime"
                                        value={formData.requestedTime} onChange={handleChange}
                                        onClick={(e) => { try { e.target.showPicker(); } catch (_) {} }}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Locations ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-map-alt'></i> Pickup &amp; Drop Locations
                        </div>

                        <div className="atr-form-row single">
                            {renderLocationField({
                                label: 'Pickup Address',
                                inputRef: pickupInputRef,
                                value: formData.pickupAddress,
                                onChange: handlePickupInputChange,
                                placeholder: 'e.g. 12 Main Street, Colombo 03',
                                lat: formData.pickupLat,
                                lng: formData.pickupLng,
                                mapField: 'pickup',
                                icon: 'bx-current-location',
                                suggestions: pickupSug,
                            })}
                        </div>

                        <div className="atr-form-row single">
                            {renderLocationField({
                                label: 'Drop Address',
                                inputRef: dropInputRef,
                                value: formData.dropAddress,
                                onChange: handleDropInputChange,
                                placeholder: 'e.g. 45 Galle Road, Kandy',
                                lat: formData.dropLat,
                                lng: formData.dropLng,
                                mapField: 'drop',
                                icon: 'bx-map-pin',
                                suggestions: dropSug,
                            })}
                        </div>

                        {/* ── Item Details ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-box'></i> Item Details
                        </div>
                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Item Type <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-category'></i>
                                    <select name="itemType" value={formData.itemType} onChange={handleChange} required>
                                        <option value="" disabled>Select item type</option>
                                        <option value="Document">Document</option>
                                        <option value="Parcel">Parcel</option>
                                        <option value="Fragile">Fragile</option>
                                        <option value="Electronics">Electronics</option>
                                        <option value="Food">Food</option>
                                        <option value="Clothing">Clothing</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Item Weight (kg)</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-dumbbell'></i>
                                    <input
                                        type="number" name="itemWeight"
                                        value={formData.itemWeight} onChange={handleChange}
                                        placeholder="e.g. 1.5" step="0.1" min="0" max="999"
                                    />
                                </div>
                                <div className="atr-input-hint">Optional — helps estimate cost</div>
                            </div>
                        </div>

                        <div className="atr-form-row single">
                            <div className="atr-form-group">
                                <label>Item Description</label>
                                <textarea
                                    name="itemDescription"
                                    value={formData.itemDescription} onChange={handleChange}
                                    placeholder="Brief description of the item..."
                                    maxLength="500"
                                />
                            </div>
                        </div>

                        {/* ── Sender ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-user'></i> Sender Details
                        </div>
                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Sender Name <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-user-circle'></i>
                                    <input type="text" name="senderName" value={formData.senderName}
                                        onChange={handleChange} placeholder="e.g. Kasun Perera" required maxLength="150" />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Sender Phone <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-phone'></i>
                                    <input type="tel" name="senderPhone" value={formData.senderPhone}
                                        onChange={handleChange} placeholder="e.g. 0771234567" required maxLength="20" />
                                </div>
                            </div>
                        </div>

                        {/* ── Receiver ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-user-check'></i> Receiver Details
                        </div>
                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Receiver Name <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-user-circle'></i>
                                    <input type="text" name="receiverName" value={formData.receiverName}
                                        onChange={handleChange} placeholder="e.g. Nimal Silva" required maxLength="150" />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Receiver Phone <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-phone'></i>
                                    <input type="tel" name="receiverPhone" value={formData.receiverPhone}
                                        onChange={handleChange} placeholder="e.g. 0712345678" required maxLength="20" />
                                </div>
                            </div>
                        </div>

                        <div className="atr-form-row single">
                            <div className="atr-form-group">
                                <label>Receiver NIC</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-id-card'></i>
                                    <input type="text" name="receiverNic" value={formData.receiverNic}
                                        onChange={handleChange} placeholder="e.g. 199012345678 or 900123456V" maxLength="100" />
                                </div>
                                <div className="atr-input-hint">Optional — used for identity verification on delivery</div>
                            </div>
                        </div>

                        {/* ── Actions ── */}
                        <div className="atr-form-actions-bar">
                            <button type="button" className="atr-btn atr-btn-secondary" onClick={handleReset}>
                                <i className='bx bx-reset'></i> Reset
                            </button>
                            <button type="submit" className="atr-btn atr-btn-primary" disabled={isSubmitting}>
                                {isSubmitting
                                    ? <><i className='bx bx-loader-alt bx-spin'></i> Submitting...</>
                                    : <><i className='bx bx-send'></i> Book Delivery</>
                                }
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Google Maps Modal ── */}
            <LocationPickerModal
                isOpen={mapModal.open}
                title={mapModal.field === 'pickup' ? '📍 Pin Pickup Location' : '📍 Pin Drop Location'}
                initialLat={mapModal.field === 'pickup' ? formData.pickupLat : formData.dropLat}
                initialLng={mapModal.field === 'pickup' ? formData.pickupLng : formData.dropLng}
                onClose={() => setMapModal({ open: false, field: null })}
                onConfirm={handleMapConfirm}
            />
        </div>
    );
}

export default PersonalDeliveryForm;
