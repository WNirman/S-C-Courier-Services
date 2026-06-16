import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';

const CustomerDashboard = ({ onDeliver, loggedInUser }) => {
    const previousDeliveries = [
        { id: 'SC100892', date: '2023-10-15', status: 'Delivered', destination: 'Los Angeles, CA' },
        { id: 'SC100865', date: '2023-10-10', status: 'Delivered', destination: 'Chicago, IL' },
        { id: 'SC100810', date: '2023-09-28', status: 'Delivered', destination: 'Miami, FL' },
    ];

    const activePackages = [
        { id: 'SC101000', ordered: '2024-02-25', destination: 'Seattle, WA', status: 'Approved' },
        { id: 'SC101015', ordered: '2024-03-02', destination: 'Denver, CO', status: 'Declined on delivery' },
    ];

    // Profile state
    const [profilePic, setProfilePic] = useState(null);
    const [custName, setCustName] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [atrRequests, setAtrRequests] = useState([]);
    const [loadingAtr, setLoadingAtr] = useState(true);

    // Cropper state
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isDragOver, setIsDragOver] = useState(false);

    const cropperImgRef = useRef(null);
    const fileInputRef = useRef(null);
    const CROP_SIZE = 280; // px diameter of the crop circle

    // Load saved profile from localStorage on mount
    useEffect(() => {
        if (loggedInUser) {
            const saved = localStorage.getItem(`profile_pic_${loggedInUser}`);
            if (saved) setProfilePic(saved);

            // Fetch customer name from Supabase
            supabase
                .from('customer')
                .select('cust_name')
                .eq('cust_email', loggedInUser)
                .single()
                .then(({ data }) => {
                    if (data && data.cust_name) setCustName(data.cust_name);
                });
        }
    }, [loggedInUser]);

    // Fetch ATR requests from Supabase
    useEffect(() => {
        if (loggedInUser) {
            const fetchAtrRequests = async () => {
                setLoadingAtr(true);
                try {
                    const { data, error } = await supabase
                        .from('atr')
                        .select('*')
                        .eq('cust_email', loggedInUser)
                        .order('atr_id', { ascending: false });
                    
                    if (error) throw error;
                    setAtrRequests(data || []);
                } catch (err) {
                    console.error('Error fetching ATR requests:', err);
                } finally {
                    setLoadingAtr(false);
                }
            };
            fetchAtrRequests();
        }
    }, [loggedInUser]);

    // Reset cropper when new image loaded
    useEffect(() => {
        if (imageSrc) {
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [imageSrc]);

    // ── File picking ──────────────────────────────────────────────────────────
    const readFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => setImageSrc(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e) => readFile(e.target.files[0]);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        readFile(e.dataTransfer.files[0]);
    };

    // ── Mouse drag ────────────────────────────────────────────────────────────
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }, [offset]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    // ── Touch drag ────────────────────────────────────────────────────────────
    const handleTouchStart = useCallback((e) => {
        const t = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
    }, [offset]);

    const handleTouchMove = useCallback((e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handleTouchEnd = useCallback(() => setIsDragging(false), []);

    // ── Canvas crop & save ────────────────────────────────────────────────────
    const handleSave = () => {
        if (!imageSrc) return;
        const img = cropperImgRef.current;
        if (!img) return;

        const canvas = document.createElement('canvas');
        const OUTPUT = 400; // output resolution
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const ctx = canvas.getContext('2d');

        // Clip to circle
        ctx.beginPath();
        ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
        ctx.clip();

        // Natural image dimensions
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;

        // Rendered dimensions inside the viewport (CROP_SIZE × CROP_SIZE container)
        const renderedW = naturalW * scale;
        const renderedH = naturalH * scale;

        // The displayed image is centred then shifted by offset
        const displayedLeft = (CROP_SIZE - renderedW) / 2 + offset.x;
        const displayedTop  = (CROP_SIZE - renderedH) / 2 + offset.y;

        // Scale factor from viewport pixels to output pixels
        const ratio = OUTPUT / CROP_SIZE;

        ctx.drawImage(
            img,
            displayedLeft * ratio,
            displayedTop  * ratio,
            renderedW * ratio,
            renderedH * ratio
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setProfilePic(dataUrl);
        if (loggedInUser) localStorage.setItem(`profile_pic_${loggedInUser}`, dataUrl);
        setShowModal(false);
        setImageSrc(null);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setImageSrc(null);
    };

    const handleRemovePic = (e) => {
        e.stopPropagation();
        setProfilePic(null);
        if (loggedInUser) localStorage.removeItem(`profile_pic_${loggedInUser}`);
    };

    // ── Rendered image style inside cropper viewport ──────────────────────────
    const imgStyle = {
        position: 'absolute',
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
        top: '50%',
        left: '50%',
        maxWidth: 'none',
        transformOrigin: 'center center',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        pointerEvents: 'auto',
        transition: isDragging ? 'none' : 'transform 0.15s ease',
    };

    return (
        <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease', padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', zIndex: 10 }}>

            {/* ── Profile Header ─────────────────────────────────────────── */}
            <div className="profile-header-section">
                {/* Avatar Frame */}
                <div className="avatar-frame" onClick={() => setShowModal(true)} title="Upload profile picture">
                    {profilePic ? (
                        <img src={profilePic} alt="Profile" className="avatar-img" />
                    ) : (
                        <div className="avatar-default">
                            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
                                <circle cx="32" cy="24" r="14" stroke="#f97316" strokeWidth="2.5" />
                                <path d="M8 56c0-13.255 10.745-24 24-24s24 10.745 24 24" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </div>
                    )}
                    <div className="avatar-overlay">
                        <i className='bx bx-camera'></i>
                        <span>Change Photo</span>
                    </div>
                    {profilePic && (
                        <button className="avatar-remove-btn" onClick={handleRemovePic} title="Remove photo">
                            <i className='bx bx-x'></i>
                        </button>
                    )}
                </div>

                {/* Name & Email */}
                <div className="profile-info">
                    <h2 className="profile-name">{custName || loggedInUser || 'Customer'}</h2>
                    <p className="profile-email"><i className='bx bx-envelope'></i> {loggedInUser || ''}</p>
                    <span className="profile-badge"><i className='bx bx-check-shield'></i> Verified Account</span>
                </div>

                {/* Deliver Now button */}
                <button className="primary-btn" onClick={onDeliver} style={{ marginLeft: 'auto', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className='bx bx-truck'></i> Deliver Now
                </button>
            </div>

            {/* ── Dashboard Grid ─────────────────────────────────────────── */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                {/* Active Packages */}
                <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInRight 1s ease backwards 0.4s', margin: 0 }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-package' style={{ color: 'var(--accent-color)' }}></i> Active Packages
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {activePackages.map((pkg, index) => (
                            <div key={index} style={{
                                padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
                                border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', transition: 'all 0.3s ease',
                            }}>
                                <div>
                                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{pkg.id}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <i className='bx bx-map' style={{ color: 'var(--accent-color)', marginRight: '4px' }}></i>{pkg.destination}
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}><strong>Ordered:</strong> {pkg.ordered}</p>
                                </div>
                                <span style={{
                                    display: 'inline-block', padding: '0.35rem 0.85rem',
                                    background: pkg.status === 'Approved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: pkg.status === 'Approved' ? 'var(--success)' : 'var(--danger)',
                                    borderRadius: '100px', fontSize: '0.85rem', fontWeight: '600',
                                    border: pkg.status === 'Approved' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)'
                                }}>{pkg.status}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Previous Deliveries */}
                <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInRight 1s ease backwards 0.2s', margin: 0 }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-history' style={{ color: 'var(--accent-color)' }}></i> Previous Deliveries
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {previousDeliveries.map((delivery, index) => (
                            <div key={index} className="delivery-item" style={{
                                padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
                                border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', transition: 'all 0.3s ease', cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='var(--card-border)'; }}
                            >
                                <div>
                                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{delivery.id}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <i className='bx bx-map' style={{ color: 'var(--accent-color)', marginRight: '4px' }}></i>{delivery.destination}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{
                                        display: 'inline-block', padding: '0.35rem 0.85rem',
                                        background: 'rgba(16,185,129,0.1)', color: 'var(--success)',
                                        borderRadius: '100px', fontSize: '0.85rem', fontWeight: '600',
                                        marginBottom: '0.5rem', border: '1px solid rgba(16,185,129,0.2)'
                                    }}>
                                        <i className='bx bx-check-circle' style={{ marginRight: '4px' }}></i>{delivery.status}
                                    </span>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{delivery.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ATR Requests */}
                <div className="action-card" style={{ width: '100%', maxWidth: '100%', padding: '2rem', animation: 'slideInRight 1s ease backwards 0.3s', margin: 0 }}>
                    <div className="card-header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                            <i className='bx bx-car' style={{ color: 'var(--accent-color)' }}></i> ATR Requests
                        </h3>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.8rem', borderRadius: '100px', fontSize: '0.85rem' }}>
                            {atrRequests.length} Total
                        </span>
                    </div>

                    {loadingAtr ? (
                        <p style={{ color: 'var(--text-secondary)' }}>
                            <i className="bx bx-loader-alt bx-spin" style={{ marginRight: '0.5rem' }}></i> Loading ATR requests...
                        </p>
                    ) : atrRequests.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>No ATR requests found.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                            {atrRequests.map((req, index) => (
                                <div key={req.atr_id || index} className="delivery-item" style={{
                                    padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
                                    border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='var(--card-border)'; }}
                                >
                                    <div>
                                        <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{req.atr_number}</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <i className='bx bx-car' style={{ color: 'var(--accent-color)', marginRight: '4px' }}></i>{req.vehicle_type}
                                        </p>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            <strong>Required:</strong> {req.required_date} @ {req.required_time}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '0.35rem 0.85rem',
                                            background: req.status === 'Approved' || req.status === 'Completed' ? 'rgba(16,185,129,0.1)' : req.status === 'Pending' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: req.status === 'Approved' || req.status === 'Completed' ? 'var(--success)' : req.status === 'Pending' ? '#f59e0b' : 'var(--danger)',
                                            borderRadius: '100px', fontSize: '0.85rem', fontWeight: '600',
                                            border: req.status === 'Approved' || req.status === 'Completed' ? '1px solid rgba(16,185,129,0.2)' : req.status === 'Pending' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(239,68,68,0.2)'
                                        }}>{req.status}</span>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            {req.estimated_cost} LKR
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Crop Modal ─────────────────────────────────────────────── */}
            {showModal && (
                <div className="cropper-backdrop" onClick={handleCloseModal}>
                    <div className="cropper-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cropper-modal-header">
                            <h3><i className='bx bx-camera'></i> Upload Profile Picture</h3>
                            <button className="cropper-close-btn" onClick={handleCloseModal}>
                                <i className='bx bx-x'></i>
                            </button>
                        </div>

                        {!imageSrc ? (
                            /* ── Drop / Select zone ── */
                            <div
                                className={`cropper-drop-zone ${isDragOver ? 'drag-active' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="cropper-drop-icon">
                                    <i className='bx bx-cloud-upload'></i>
                                </div>
                                <p className="cropper-drop-title">Drag &amp; drop your photo here</p>
                                <p className="cropper-drop-sub">or click to browse — JPG, PNG, WEBP supported</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                            </div>
                        ) : (
                            /* ── Cropper area ── */
                            <>
                                <p className="cropper-hint"><i className='bx bx-move'></i> Drag the image to position · use slider to zoom</p>

                                <div
                                    className="cropper-viewport"
                                    style={{ width: CROP_SIZE, height: CROP_SIZE }}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    <img
                                        ref={cropperImgRef}
                                        src={imageSrc}
                                        alt="Crop preview"
                                        style={imgStyle}
                                        draggable={false}
                                    />
                                    {/* Circle overlay mask */}
                                    <div className="cropper-circle-mask" />
                                </div>

                                {/* Zoom slider */}
                                <div className="cropper-slider-row">
                                    <i className='bx bx-zoom-out'></i>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3"
                                        step="0.01"
                                        value={scale}
                                        onChange={(e) => setScale(parseFloat(e.target.value))}
                                        className="cropper-slider"
                                    />
                                    <i className='bx bx-zoom-in'></i>
                                </div>

                                {/* Actions */}
                                <div className="cropper-actions">
                                    <button className="cropper-btn-secondary" onClick={() => { setImageSrc(null); setScale(1); setOffset({ x: 0, y: 0 }); }}>
                                        <i className='bx bx-image-add'></i> Choose Different
                                    </button>
                                    <button className="cropper-btn-primary" onClick={handleSave}>
                                        <i className='bx bx-check'></i> Save Photo
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDashboard;
