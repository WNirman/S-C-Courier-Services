import React, { useState, useEffect } from 'react';
import logoImg from './assets/favicon.png';
import { supabase } from './supabaseClient';

function AtrForm({ onBack, loggedInUser }) {
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
            status: 'Pending',
            approvedBy: '',
            approvalDate: ''
        };
    });

    useEffect(() => {
        localStorage.setItem('atr_form_data', JSON.stringify(formData));
    }, [formData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const getStatusClass = () => {
        const map = {
            'Pending': 'pending',
            'Approved': 'approved',
            'Rejected': 'rejected',
            'Completed': 'approved',
            'Cancelled': 'rejected'
        };
        return map[formData.status] || 'pending';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('ATR Form Submitted:', formData);

        try {
            const insertData = {
                dep_id: parseInt(formData.department),
                atr_number: formData.atrNumber,
                required_date: formData.requiredDate,
                required_time: formData.requiredTime,
                vehicle_type: formData.vehicleType,
                purpose_of_travel: formData.purposeOfTravel,
                principal_passenger_name: formData.passengerName,
                principal_passenger_designation: formData.passengerDesignation,
                estimated_distance: parseFloat(formData.estimatedDistance),
                estimated_cost: parseFloat(formData.estimatedCost),
                actual_distance: formData.actualDistance ? parseFloat(formData.actualDistance) : null,
                actual_cost: formData.actualCost ? parseFloat(formData.actualCost) : null,
                status: formData.status,
                approved_by: formData.approvedBy ? parseInt(formData.approvedBy) : null,
                approval_date: formData.approvalDate ? formData.approvalDate : null,
                cust_email: loggedInUser
            };

            const { data, error } = await supabase.from('atr').insert(insertData);
            if (error) throw error;

            alert('Your ATR request has been sent successfully!');
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
            status: 'Pending',
            approvedBy: '',
            approvalDate: ''
        });
        localStorage.removeItem('atr_form_data');
    };

    return (
        <div className="atr-page">
            <div className="atr-split-layout">
                {/* Left Panel */}
                <div className="atr-left-panel">
                    <div className="atr-left-content">
                        <div className="atr-left-logo" onClick={onBack} style={{ cursor: 'pointer' }}>
                            <img src={logoImg} alt="SC Courier" />
                            <span>SC Courier</span>
                        </div>

                        <h2>Welcome to <br /><span className="atr-highlight">Transport Request</span></h2>
                        <p>Submit and manage your vehicle authorization requests. Fill in the details and get instant approval from your department head.</p>

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

                {/* Right Panel */}
                <div className="atr-right-panel">
                    <div className="atr-form-header">
                        <h1><i className='bx bx-car'></i> Authorization To Request</h1>
                        <p>Please provide below details to create a transport request</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Request Information */}
                        <div className="atr-section-title">
                            <i className='bx bx-info-circle'></i> Request Information
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>ATR Number <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-hash'></i>
                                    <input type="text" name="atrNumber" value={formData.atrNumber} onChange={handleChange} placeholder="e.g. ATR-2026-005" required maxLength="50" />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Department <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-buildings'></i>
                                    <select name="department" value={formData.department} onChange={handleChange} required>
                                        <option value="" disabled>Select Department</option>
                                        <option value="1">Operations</option>
                                        <option value="2">Finance</option>
                                        <option value="3">Human Resources</option>
                                        <option value="4">Logistics</option>
                                        <option value="5">Administration</option>
                                        <option value="6">IT</option>
                                        <option value="7">Marketing</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="atr-form-row three-col">
                            <div className="atr-form-group">
                                <label>Required Date <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-calendar'></i>
                                    <input 
                                        type="date" 
                                        name="requiredDate" 
                                        value={formData.requiredDate} 
                                        onChange={handleChange} 
                                        onClick={(e) => {
                                            try {
                                                e.target.showPicker();
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Required Time <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-time'></i>
                                    <input 
                                        type="time" 
                                        name="requiredTime" 
                                        value={formData.requiredTime} 
                                        onChange={handleChange} 
                                        onClick={(e) => {
                                            try {
                                                e.target.showPicker();
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Vehicle Type <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-car'></i>
                                    <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} required>
                                        <option value="" disabled>Select Vehicle</option>
                                        <option value="Van">Van</option>
                                        <option value="Bike">Bike</option>
                                        <option value="Truck">Truck</option>
                                        <option value="Car">Car</option>
                                        <option value="Three-Wheeler">Three-Wheeler</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="atr-form-row single">
                            <div className="atr-form-group">
                                <label>Purpose of Travel <span className="required">*</span></label>
                                <textarea name="purposeOfTravel" value={formData.purposeOfTravel} onChange={handleChange} placeholder="Describe the reason for this transport request..." required></textarea>
                            </div>
                        </div>

                        {/* Passenger Details */}
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

                        {/* Estimated Cost & Distance */}
                        <div className="atr-section-title">
                            <i className='bx bx-calculator'></i> Estimated Cost & Distance
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Estimated Distance (km) <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-map-alt'></i>
                                    <input type="number" name="estimatedDistance" value={formData.estimatedDistance} onChange={handleChange} placeholder="e.g. 25.50" step="0.01" min="0" max="999999.99" required />
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Estimated Cost (LKR) <span className="required">*</span></label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-money'></i>
                                    <input type="number" name="estimatedCost" value={formData.estimatedCost} onChange={handleChange} placeholder="e.g. 1500.00" step="0.01" min="0" max="99999999.99" required />
                                </div>
                            </div>
                        </div>

                        {/* Actual Cost & Distance */}
                        <div className="atr-section-title">
                            <i className='bx bx-check-double'></i> Actual Cost & Distance
                        </div>

                        <div className="atr-form-row">
                            <div className="atr-form-group">
                                <label>Actual Distance (km)</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-map-alt'></i>
                                    <input type="number" name="actualDistance" value={formData.actualDistance} onChange={handleChange} placeholder="e.g. 26.20" step="0.01" min="0" max="999999.99" />
                                </div>
                                <div className="atr-input-hint">Filled after trip completion</div>
                            </div>
                            <div className="atr-form-group">
                                <label>Actual Cost (LKR)</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-money'></i>
                                    <input type="number" name="actualCost" value={formData.actualCost} onChange={handleChange} placeholder="e.g. 1650.00" step="0.01" min="0" max="99999999.99" />
                                </div>
                                <div className="atr-input-hint">Filled after trip completion</div>
                            </div>
                        </div>

                        {/* Approval Details */}
                        <div className="atr-section-title">
                            <i className='bx bx-shield-quarter'></i> Approval Details
                        </div>

                        <div className="atr-form-row three-col">
                            <div className="atr-form-group">
                                <label>Status</label>
                                <select name="status" value={formData.status} onChange={handleChange}>
                                    <option value="Pending">Pending</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                                <div>
                                    <span className={`atr-status-preview ${getStatusClass()}`}>
                                        <span className="dot"></span> {formData.status}
                                    </span>
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Approved By</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-user-check'></i>
                                    <select name="approvedBy" value={formData.approvedBy} onChange={handleChange}>
                                        <option value="">Not Assigned</option>
                                        <option value="801">Mr. Perera (Director)</option>
                                        <option value="802">Mrs. Silva (GM)</option>
                                        <option value="803">Mr. Wijesinghe (AGM)</option>
                                        <option value="804">Mrs. Jayawardena (HOD)</option>
                                        <option value="805">Mr. Ratnayake (Manager)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="atr-form-group">
                                <label>Approval Date & Time</label>
                                <div className="atr-input-with-icon">
                                    <i className='bx bx-calendar-edit'></i>
                                    <input 
                                        type="datetime-local" 
                                        name="approvalDate" 
                                        value={formData.approvalDate} 
                                        onChange={handleChange} 
                                        onClick={(e) => {
                                            try {
                                                e.target.showPicker();
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
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
