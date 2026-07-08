import React, { useState, useEffect } from 'react';
import logoImg from './assets/favicon.png';
import { supabase } from './supabaseClient';

function PersonalDeliveryForm({ onBack, loggedInUser }) {
    const emptyForm = {
        requestedDate: '',
        requestedTime: '',
        pickupAddress: '',
        dropAddress: '',
        itemType: '',
        itemWeight: '',
        itemDescription: '',
        senderName: '',
        senderPhone: '',
        receiverName: '',
        receiverPhone: '',
        receiverNic: '',
    };

    const [formData, setFormData] = useState(() => {
        const saved = localStorage.getItem('pd_form_data');
        if (saved) {
            try { return JSON.parse(saved); } catch { /* ignore */ }
        }
        return emptyForm;
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-fill sender name/phone from Supabase customer record
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
                            senderName: prev.senderName || data.cust_name || '',
                            senderPhone: prev.senderPhone || data.cust_phoneno || '',
                        }));
                    }
                });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loggedInUser]);

    // Persist form to localStorage
    useEffect(() => {
        localStorage.setItem('pd_form_data', JSON.stringify(formData));
    }, [formData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleReset = () => {
        setFormData(emptyForm);
        localStorage.removeItem('pd_form_data');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const insertData = {
                cust_email: loggedInUser,
                pickup_address: formData.pickupAddress.trim(),
                drop_address: formData.dropAddress.trim(),
                item_type: formData.itemType,
                item_weight: formData.itemWeight.trim() || null,
                item_description: formData.itemDescription.trim() || null,
                sender_name: formData.senderName.trim(),
                sender_phone: formData.senderPhone.trim(),
                receiver_name: formData.receiverName.trim(),
                receiver_phone: formData.receiverPhone.trim(),
                receiver_nic: formData.receiverNic.trim() || null,
                status: 'Pending',
                requested_date: formData.requestedDate,
                requested_time: formData.requestedTime,
            };

            const { error } = await supabase.from('personal_delivery').insert(insertData);
            if (error) throw error;

            alert('Your personal delivery request has been submitted successfully!');
            handleReset();
            if (onBack) onBack();
        } catch (err) {
            console.error('Error submitting personal delivery request:', err);
            alert('Failed to submit request: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

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

                        {/* Feature bullets */}
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

                        {/* ── Delivery Schedule ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-calendar-check'></i> Delivery Schedule
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Pickup Date <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-calendar'></i>
                                    <input
                                        type="date"
                                        name="requestedDate"
                                        value={formData.requestedDate}
                                        onChange={handleChange}
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
                                        type="time"
                                        name="requestedTime"
                                        value={formData.requestedTime}
                                        onChange={handleChange}
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
                            <div className="atr-form-group">
                                <label>Pickup Address <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-current-location'></i>
                                    <input
                                        type="text"
                                        name="pickupAddress"
                                        value={formData.pickupAddress}
                                        onChange={handleChange}
                                        placeholder="e.g. 12 Main Street, Colombo 03"
                                        required
                                        maxLength="300"
                                    />
                                </div>
                                <div className="atr-input-hint">
                                    <i className='bx bx-map' style={{ marginRight: '4px' }}></i>
                                    Google Maps autocomplete will be added soon
                                </div>
                            </div>
                        </div>

                        <div className="atr-form-row single">
                            <div className="atr-form-group">
                                <label>Drop Address <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-map-pin'></i>
                                    <input
                                        type="text"
                                        name="dropAddress"
                                        value={formData.dropAddress}
                                        onChange={handleChange}
                                        placeholder="e.g. 45 Galle Road, Kandy"
                                        required
                                        maxLength="300"
                                    />
                                </div>
                                <div className="atr-input-hint">
                                    <i className='bx bx-map' style={{ marginRight: '4px' }}></i>
                                    Google Maps autocomplete will be added soon
                                </div>
                            </div>
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
                                    <select
                                        name="itemType"
                                        value={formData.itemType}
                                        onChange={handleChange}
                                        required
                                    >
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
                                        type="number"
                                        name="itemWeight"
                                        value={formData.itemWeight}
                                        onChange={handleChange}
                                        placeholder="e.g. 1.5"
                                        step="0.1"
                                        min="0"
                                        max="999"
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
                                    value={formData.itemDescription}
                                    onChange={handleChange}
                                    placeholder="Brief description of the item (e.g. A4 documents, birthday gift, laptop bag)..."
                                    maxLength="500"
                                />
                            </div>
                        </div>

                        {/* ── Sender Details ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-user'></i> Sender Details
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Sender Name <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-user-circle'></i>
                                    <input
                                        type="text"
                                        name="senderName"
                                        value={formData.senderName}
                                        onChange={handleChange}
                                        placeholder="e.g. Kasun Perera"
                                        required
                                        maxLength="150"
                                    />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Sender Phone <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-phone'></i>
                                    <input
                                        type="tel"
                                        name="senderPhone"
                                        value={formData.senderPhone}
                                        onChange={handleChange}
                                        placeholder="e.g. 0771234567"
                                        required
                                        maxLength="20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Receiver Details ── */}
                        <div className="atr-section-title">
                            <i className='bx bx-user-check'></i> Receiver Details
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Receiver Name <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-user-circle'></i>
                                    <input
                                        type="text"
                                        name="receiverName"
                                        value={formData.receiverName}
                                        onChange={handleChange}
                                        placeholder="e.g. Nimal Silva"
                                        required
                                        maxLength="150"
                                    />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Receiver Phone <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-phone'></i>
                                    <input
                                        type="tel"
                                        name="receiverPhone"
                                        value={formData.receiverPhone}
                                        onChange={handleChange}
                                        placeholder="e.g. 0712345678"
                                        required
                                        maxLength="20"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="atr-form-row single">
                            <div className="atr-form-group">
                                <label>Receiver NIC</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-id-card'></i>
                                    <input
                                        type="text"
                                        name="receiverNic"
                                        value={formData.receiverNic}
                                        onChange={handleChange}
                                        placeholder="e.g. 199012345678 or 900123456V"
                                        maxLength="100"
                                    />
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
        </div>
    );
}

export default PersonalDeliveryForm;
