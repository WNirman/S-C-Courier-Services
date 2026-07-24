import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import logoImg from './assets/favicon.png';
import servicesGif from './assets/services.gif';
import aboutGif from './assets/about.gif';
import contactGif from './assets/contact.gif';
import CustomerDashboard from './CustomerDashboard';
import AtrForm from './AtrForm';
import PersonalDeliveryForm from './PersonalDeliveryForm';
import AdminDashboard from './AdminDashboard';
import StaffDashboard from './StaffDashboard';
import Chatbot from './Chatbot';
import StatsSection from './StatsSection';

const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

function App({ onNavigate }) {
    
    const [loggedInUser, setLoggedInUser] = useState(() => {
        return localStorage.getItem('loggedInUser') || null;
    });

    const [activeForm, setActiveForm] = useState(() => {
        const savedForm = localStorage.getItem('activeForm') || 'tracking';
        const savedUser = localStorage.getItem('loggedInUser');
        const authRoutes = ['dashboard', 'admin', 'staff', 'atr', 'personal-delivery'];
        if (!savedUser && authRoutes.includes(savedForm)) {
            return 'tracking';
        }
        return savedForm;
    });

    useEffect(() => {
        if (loggedInUser) {
            localStorage.setItem('loggedInUser', loggedInUser);
        } else {
            localStorage.removeItem('loggedInUser');
            const authRoutes = ['dashboard', 'admin', 'staff', 'atr', 'personal-delivery'];
            if (authRoutes.includes(activeForm)) {
                setActiveForm('tracking');
            }
        }
    }, [loggedInUser, activeForm]);

    useEffect(() => {
        localStorage.setItem('activeForm', activeForm);
    }, [activeForm]);

    const [showPassword, setShowPassword] = useState(false);

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [profileDetails, setProfileDetails] = useState({
        name: '',
        email: '',
        role: '',
        phone: '',
    });
    const [profilePhoto, setProfilePhoto] = useState(null);
    const profilePhotoInputRef = useRef(null);

    // Tracking State
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [trackingResult, setTrackingResult] = useState(null);

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [assignedStaff, setAssignedStaff] = useState([]); // Array to store assigned staff emails

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data, error } = await supabase
                    .from('staff')
                    .select('staff_email');
                if (error) throw error;
                if (data) {
                    setAssignedStaff(data.map(s => s.staff_email));
                }
            } catch (err) {
                console.error('Failed to fetch staff list:', err);
            }
        };
        fetchStaff();
    }, []);

    useEffect(() => {
        const loadProfileDetails = async () => {
            if (!loggedInUser) {
                setProfileDetails({
                    name: '',
                    email: '',
                    role: '',
                    phone: '',
                });
                setProfilePhoto(null);
                return;
            }

            const savedPhoto = localStorage.getItem(`profile_photo_${loggedInUser}`);
            setProfilePhoto(savedPhoto || null);

            if (loggedInUser === 'admin@sccourier.com') {
                setProfileDetails({
                    name: 'Administrator',
                    email: loggedInUser,
                    role: 'Admin',
                    phone: 'N/A',
                });
                return;
            }

            const { data: staffData } = await supabase
                .from('staff')
                .select('staff_name, staff_email, staff_phone, staff_role')
                .eq('staff_email', loggedInUser)
                .single();

            if (staffData) {
                setProfileDetails({
                    name: staffData.staff_name || 'Staff Member',
                    email: staffData.staff_email || loggedInUser,
                    role: staffData.staff_role || 'Staff',
                    phone: staffData.staff_phone || 'N/A',
                });
                return;
            }

            const { data: customerData } = await supabase
                .from('customer')
                .select('cust_name, cust_email, cust_phoneno')
                .eq('cust_email', loggedInUser)
                .single();

            if (customerData) {
                setProfileDetails({
                    name: customerData.cust_name || 'Customer',
                    email: customerData.cust_email || loggedInUser,
                    role: 'Customer',
                    phone: customerData.cust_phoneno || 'N/A',
                });
            }
        };

        loadProfileDetails();
    }, [loggedInUser]);

    // Registration State
    const [custName, setCustName] = useState('');
    const [custEmail, setCustEmail] = useState('');
    const [custAddress, setCustAddress] = useState('');
    const [custPhone, setCustPhone] = useState('');
    const [custPassword, setCustPassword] = useState('');
    const [custConfirm, setCustConfirm] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [registerSuccess, setRegisterSuccess] = useState(false);

    // Forgot Password State
    const [forgotEmail, setForgotEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    const handleResetPassword = (e) => {
        e.preventDefault();
        if (!forgotEmail || !newPassword || !confirmNewPassword) return;
        
        if (newPassword !== confirmNewPassword) {
            alert('Passwords do not match');
            return;
        }

        setIsResetting(true);
        setResetSuccess(false);

        setTimeout(() => {
            setIsResetting(false);
            setResetSuccess(true);
            setTimeout(() => {
                setActiveForm('login');
                setResetSuccess(false);
                setForgotEmail('');
                setNewPassword('');
                setConfirmNewPassword('');
            }, 1500);
        }, 1500);
    };

    const handleTrackPackage = (e) => {
        e.preventDefault();
        if (!trackingNumber) return;

        setIsTracking(true);
        setTrackingResult(null);

        setTimeout(() => {
            setIsTracking(false);
            setTrackingResult({
                id: trackingNumber,
                status: 'In Transit',
                location: 'Distribution Center, NY',
                progress: 60
            });
        }, 1200);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username || !password) return;

        setIsLoggingIn(true);
        setLoginSuccess(false);

        try {
            // 1. Check Admin Hardcode
            if (username === 'admin@sccourier.com' && password === 'admin123') {
                setIsLoggingIn(false);
                setLoginSuccess(true);
                setTimeout(() => {
                    setLoggedInUser(username);
                    setActiveForm('admin');
                    setLoginSuccess(false);
                    setUsername('');
                    setPassword('');
                }, 1000);
                return;
            }

            // 2. Check Staff Table
            const { data: staffData } = await supabase
                .from('staff')
                .select('*')
                .eq('staff_email', username)
                .single();

            if (staffData) {
                // Allow access only if the account is active
                if (staffData.staff_active_status === false) {
                    alert('Account is inactive. Access denied.');
                    setIsLoggingIn(false);
                    return;
                }

                // Verify the username and password against the stored account
                const dbPassword = staffData.staff_password;
                const isHashed = dbPassword && dbPassword.length === 64 && /^[0-9a-f]+$/i.test(dbPassword);
                const passwordToCompare = isHashed ? await hashPassword(password) : password;

                if (dbPassword === passwordToCompare) {
                    setIsLoggingIn(false);
                    setLoginSuccess(true);
                    setTimeout(() => {
                        setLoggedInUser(username);
                        setActiveForm('staff');
                        setLoginSuccess(false);
                        setUsername('');
                        setPassword('');
                    }, 1000);
                    return;
                } else {
                    alert('Incorrect staff password');
                    setIsLoggingIn(false);
                    return;
                }
            }

            // 3. Check Customer Table
            const { data: custData } = await supabase
                .from('customer')
                .select('*')
                .eq('cust_email', username)
                .single();

            if (custData) {
                if (custData.cust_password === password) {
                    setIsLoggingIn(false);
                    setLoginSuccess(true);
                    setTimeout(() => {
                        setLoggedInUser(username);
                        setActiveForm('dashboard');
                        setLoginSuccess(false);
                        setUsername('');
                        setPassword('');
                    }, 1000);
                    return;
                } else {
                    alert('Incorrect customer password');
                    setIsLoggingIn(false);
                    return;
                }
            }

            // Not found
            alert('User not found in system');
            setIsLoggingIn(false);
        } catch (err) {
            console.error('Login error:', err);
            alert('Login error. Please try again.');
            setIsLoggingIn(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!custName || !custEmail || !custPhone || !custPassword || !custConfirm) return;
        if (custPassword !== custConfirm) {
            alert('Passwords do not match');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(custEmail)) {
            alert('Invalid email format');
            return;
        }
        if (custPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        setIsRegistering(true);
        setRegisterSuccess(false);

        try {
            // Check if email already exists
            const { data: existing } = await supabase
                .from('customer')
                .select('customer_id')
                .eq('cust_email', custEmail)
                .single();

            if (existing) {
                alert('Email already registered!');
                setIsRegistering(false);
                return;
            }

            // Insert new customer
            const { error } = await supabase.from('customer').insert({
                cust_name: custName,
                cust_email: custEmail,
                cust_address: custAddress || 'N/A',
                cust_phoneno: custPhone,
                cust_type: 'Regular',
                cust_password: custPassword,
            });

            if (error) throw error;

            setIsRegistering(false);
            setRegisterSuccess(true);

            setTimeout(() => {
                setActiveForm('login');
                setRegisterSuccess(false);
                setCustName('');
                setCustEmail('');
                setCustAddress('');
                setCustPhone('');
                setCustPassword('');
                setCustConfirm('');
            }, 1500);
        } catch (err) {
            console.error('Registration error:', err);
            alert('Registration failed. Please try again.');
            setIsRegistering(false);
        }
    };

    const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];

    if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
    }

    if (!loggedInUser) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        const photoData = event.target.result;
        setProfilePhoto(photoData);
        localStorage.setItem(`profile_photo_${loggedInUser}`, photoData);
    };

    reader.readAsDataURL(file);
    };

    const handleRemoveProfilePhoto = () => {
        if (!loggedInUser) return;

        setProfilePhoto(null);
        localStorage.removeItem(`profile_photo_${loggedInUser}`);

        if (profilePhotoInputRef.current) {
            profilePhotoInputRef.current.value = '';
        }
    };
    return (
        <>
            <div className="background-elements">
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
                <div className="orb orb-3"></div>
            </div>

            <nav className="navbar">
                <div className="logo" onClick={() => setActiveForm('tracking')}>
                    <img src={logoImg} alt="SC Courier" style={{ height: '70px' }} />
                    <span>SC Courier</span>
                </div>
                {activeForm !== 'dashboard' && activeForm !== 'atr' && activeForm !== 'register' && activeForm !== 'admin' && activeForm !== 'staff' && (
                    <div className="nav-links">
                        <a href="#home" className={activeForm === 'tracking' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveForm('tracking'); }}>Home</a>
                        <a href="#services" className={activeForm === 'services' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveForm('services'); }}>Services</a>
                        <a href="#about" className={activeForm === 'about' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveForm('about'); }}>About</a>
                        <a href="#contact" className={activeForm === 'contact' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveForm('contact'); }}>Contact Us</a>
                    </div>
                )}
                {(activeForm === 'dashboard' || activeForm === 'admin' || activeForm === 'staff') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'none', '@media(minWidth: 768px)': { display: 'block' } }}>Welcome, {loggedInUser === 'admin@sccourier.com' ? 'Admin' : (assignedStaff.includes(loggedInUser) ? 'Staff' : (loggedInUser || 'User'))}!</span>
                        <div style={{ position: 'relative' }}>
                <div
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--accent-color)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        overflow: 'hidden',
                    }}
                >
                    {profilePhoto ? (
                        <img
                            src={profilePhoto}
                            alt="Profile"
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                objectFit: 'cover',
                            }}
                        />
                    ) : (
                        loggedInUser
                            ? loggedInUser === 'admin@sccourier.com'
                                ? 'A'
                                : assignedStaff.includes(loggedInUser)
                                    ? 'S'
                                    : loggedInUser.charAt(0)
                            : 'U'
                    )}
                </div>

                {showProfileMenu && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '52px',
                            right: 0,
                            width: '260px',
                            background: 'rgba(20, 20, 20, 0.98)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '16px',
                            padding: '1.2rem',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
                            zIndex: 999,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                            <div
                                style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-color)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '1.2rem',
                                    overflow: 'hidden',
                                }}
                            >
                                {profilePhoto ? (
                                    <img
                                        src={profilePhoto}
                                        alt="Profile"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    profileDetails.role?.toLowerCase() === 'admin' ? 'A' : profileDetails.role?.toLowerCase() === 'staff' ? 'S' : 'U'
                                )}
                            </div>

                            <div>
                                <h4 style={{ color: '#fff', marginBottom: '0.2rem' }}>
                                    {profileDetails.name}
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    {profileDetails.role}
                                </p>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                            <i className="bx bx-envelope" style={{ color: 'var(--accent-color)', marginRight: '0.4rem' }}></i>
                            {profileDetails.email}
                        </p>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            <i className="bx bx-phone" style={{ color: 'var(--accent-color)', marginRight: '0.4rem' }}></i>
                            {profileDetails.phone}
                        </p>

                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => profilePhotoInputRef.current?.click()}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem',
                                    borderRadius: '10px',
                                    border: '1px solid var(--card-border)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                }}
                            >
                                <i className="bx bx-camera" style={{ marginRight: '0.35rem' }}></i>
                                Upload
                            </button>

                            {profilePhoto && (
                                <button
                                    type="button"
                                    onClick={handleRemoveProfilePhoto}
                                    style={{
                                        flex: 1,
                                        padding: '0.65rem',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                    }}
                                >
                                    <i className="bx bx-trash" style={{ marginRight: '0.35rem' }}></i>
                                    Remove
                                </button>
                            )}

                            <input
                                ref={profilePhotoInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePhotoChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>
                )}
            </div>
                        <button className="nav-login-btn" onClick={() => { setLoggedInUser(null); setShowProfileMenu(false); setActiveForm('login'); }} style={{ marginLeft: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <i className='bx bx-log-out'></i>
                            <span>Logout</span>
                        </button>
                    </div>
                )}
            </nav>

            <main className="container">
                {activeForm === 'admin' ? (
                    <AdminDashboard 
                        assignedStaff={assignedStaff}
                        onAssignStaff={(email) => { if (!assignedStaff.includes(email)) setAssignedStaff([...assignedStaff, email]); }} 
                        onRemoveStaff={async (email) => {
                            await supabase.from('staff').delete().eq('staff_email', email);
                            setAssignedStaff(assignedStaff.filter(s => s !== email));
                        }}
                        loggedInUser={loggedInUser}
                    />
                ) : activeForm === 'staff' ? (
                    <StaffDashboard loggedInUser={loggedInUser} />
                ) : activeForm === 'dashboard' ? (
                    <CustomerDashboard
                        onDeliver={() => setActiveForm('atr')}
                        onPersonalDeliver={() => setActiveForm('personal-delivery')}
                        loggedInUser={loggedInUser}
                    />
                ) : activeForm === 'atr' ? (
                    <AtrForm onBack={() => setActiveForm('dashboard')} loggedInUser={loggedInUser} />
                ) : activeForm === 'personal-delivery' ? (
                    <PersonalDeliveryForm onBack={() => setActiveForm('dashboard')} loggedInUser={loggedInUser} />
                ) : activeForm === 'register' ? (
                    <div className="atr-page">
                        <div className="atr-split-layout">
                            <div className="atr-left-panel">
                                <div className="atr-left-content">
                                    <div className="atr-left-logo" onClick={() => setActiveForm('tracking')} style={{ cursor: 'pointer' }}>
                                        <img src={logoImg} alt="SC Courier" />
                                        <span>SC Courier</span>
                                    </div>
                                    <h2>Register <br /><span className="atr-highlight">Now</span></h2>
                                    <p>All fields are required to create an account.</p>
                                    <div className="atr-lottie-container">
                                        <lottie-player
                                            src="https://assets3.lottiefiles.com/packages/lf20_kdx6cani.json"
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
                                    <h1><i className='bx bx-user-plus'></i> Customer Registration</h1>
                                    <p>Provide the details below</p>
                                </div>
                                <form onSubmit={handleRegister}>
                                    <div className="atr-form-row">
                                        <div className="atr-form-group">
                                            <label>Full Name <span className="required">*</span></label>
                                            <div className="atr-input-with-icon">
                                                <i className='bx bx-user'></i>
                                                <input
                                                    type="text"
                                                    value={custName}
                                                    onChange={(e) => setCustName(e.target.value)}
                                                    placeholder="Enter full name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="atr-form-group">
                                            <label>Email <span className="required">*</span></label>
                                            <div className="atr-input-with-icon">
                                                <i className='bx bx-envelope'></i>
                                                <input
                                                    type="email"
                                                    value={custEmail}
                                                    onChange={(e) => setCustEmail(e.target.value)}
                                                    placeholder="Enter email"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="atr-form-row">
                                        <div className="atr-form-group">
                                            <label>Address <span className="required">*</span></label>
                                            <div className="atr-input-with-icon">
                                                <i className='bx bx-map'></i>
                                                <input
                                                    type="text"
                                                    value={custAddress}
                                                    onChange={(e) => setCustAddress(e.target.value)}
                                                    placeholder="Enter address"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="atr-form-group">
                                            <label>Phone Number <span className="required">*</span></label>
                                            <div className="atr-input-with-icon">
                                                <i className='bx bx-phone'></i>
                                                <input
                                                    type="tel"
                                                    value={custPhone}
                                                    onChange={(e) => setCustPhone(e.target.value)}
                                                    placeholder="Enter phone number"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="atr-form-row">
                                        <div className="atr-form-group">
                                            <label>Password <span className="required">*</span></label>
                                            <div className="atr-input-with-icon">
                                                <i className='bx bx-lock-alt'></i>
                                                <input
                                                    type="password"
                                                    value={custPassword}
                                                    onChange={(e) => setCustPassword(e.target.value)}
                                                    placeholder="Create a password"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="atr-form-group">
                                            <label>Confirm Password <span className="required">*</span></label>
                                            <div className="atr-input-with-icon">
                                                <i className='bx bx-lock-alt'></i>
                                                <input
                                                    type="password"
                                                    value={custConfirm}
                                                    onChange={(e) => setCustConfirm(e.target.value)}
                                                    placeholder="Re-enter password"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="atr-form-actions-bar">
                                        <button type="submit" className="atr-btn atr-btn-primary" disabled={isRegistering || registerSuccess}>
                                            {isRegistering ? (
                                                <><i className='bx bx-loader-alt bx-spin'></i> Registering...</>
                                            ) : registerSuccess ? (
                                                <><i className='bx bx-check'></i> Success</>
                                            ) : (
                                                <><span>Create Account</span></>
                                            )}
                                        </button>
                                    </div>
                                </form>
                                <button type="button" className="back-btn" onClick={() => setActiveForm('login')}>
                                    <i className='bx bx-left-arrow-alt'></i> Back to Login
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="main-content">
                        {(activeForm === 'services' || activeForm === 'about' || activeForm === 'contact') && (
                            <div className="action-card video-card" style={{ marginRight: '4rem', animation: 'slideInLeft 0.8s ease-out forwards' }}>
                                <div className="form-container active" style={{ padding: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '12px' }}>
                                    <img 
                                        src={activeForm === 'services' ? servicesGif : activeForm === 'about' ? aboutGif : contactGif} 
                                        alt={`${activeForm} Animation`} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} 
                                    />
                                </div>
                            </div>
                        )}

                        <div key={activeForm} className="text-section" style={{ animation: (activeForm === 'services' || activeForm === 'about' || activeForm === 'contact') ? 'none' : 'fadeUp 1s ease backwards' }}>
                            {activeForm === 'services' ? (
                                <>
                                    <h1 style={{ animation: 'slideInRight 0.8s ease-out backwards' }}>Our <br /><span className="highlight">Services</span></h1>
                                    <p style={{ animation: 'slideInRight 0.8s ease-out backwards 0.15s' }}>We provide comprehensive courier services tailored to your needs. From individual customers wanting standard shipping to companies requiring bulk distribution, we have you covered.</p>
                                    <ul style={{ marginTop: '1.5rem', listStyle: 'none', color: 'var(--text-secondary)' }}>
                                        <li style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.3s' }}><i className='bx bx-check-circle' style={{ color: 'var(--success)', marginRight: '0.8rem', fontSize: '1.2rem' }}></i> Corporate Partnerships</li>
                                        <li style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.45s' }}><i className='bx bx-check-circle' style={{ color: 'var(--success)', marginRight: '0.8rem', fontSize: '1.2rem' }}></i> Individual & Commercial Shipping</li>
                                        <li style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.6s' }}><i className='bx bx-check-circle' style={{ color: 'var(--success)', marginRight: '0.8rem', fontSize: '1.2rem' }}></i> Same-Day Local Delivery</li>
                                        <li style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.75s' }}><i className='bx bx-check-circle' style={{ color: 'var(--success)', marginRight: '0.8rem', fontSize: '1.2rem' }}></i> Secure Package Handling</li>
                                    </ul>
                                </>
                            ) : activeForm === 'about' ? (
                                <>
                                    <h1 style={{ animation: 'slideInRight 0.8s ease-out backwards' }}>About <br/><span className="highlight">Us</span></h1>
                                    <p style={{ animation: 'slideInRight 0.8s ease-out backwards 0.2s' }}>SC Courier is dedicated to fast, reliable, and secure package delivery. We built this web application to streamline our operations, providing our customers with real-time tracking, hassle-free registration, and effective management for all courier services.</p>
                                    <p style={{ marginTop: '1rem', animation: 'slideInRight 0.8s ease-out backwards 0.4s' }}>Our mission is to bridge the gap between people and businesses with cutting-edge technology and a committed delivery fleet.</p>
                                </>
                            ) : activeForm === 'contact' ? (
                                <>
                                    <h1 style={{ animation: 'slideInRight 0.8s ease-out backwards' }}>Contact <br/><span className="highlight">Us</span></h1>
                                    <p style={{ animation: 'slideInRight 0.8s ease-out backwards 0.15s' }}>Have questions, or need support with your shipments? Reach out to our dedicated team anytime.</p>
                                    <div style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>
                                        <p style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.3s' }}><i className='bx bx-phone' style={{ color: 'var(--accent-color)', marginRight: '1rem', fontSize: '1.4rem' }}></i> +1 (555) 123-4567</p>
                                        <p style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.45s' }}><i className='bx bx-envelope' style={{ color: 'var(--accent-color)', marginRight: '1rem', fontSize: '1.4rem' }}></i> support@sccourier.com</p>
                                        <p style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', animation: 'slideInRight 0.8s ease-out backwards 0.6s' }}><i className='bx bx-map' style={{ color: 'var(--accent-color)', marginRight: '1rem', fontSize: '1.4rem' }}></i> 123 Logistics Way, NY 10001</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h1>Track Your <br /><span className="highlight">Delivery</span> Instantly</h1>
                                    <p>Enter your tracking number below to get real-time updates on your package location and delivery status.</p>
                                    <StatsSection />
                                </>
                            )}
                        </div>

                        {(activeForm === 'tracking' || activeForm === 'login' || activeForm === 'forgot') && (
                            <div className="action-card">
                                {/* Tracking Form */}
                                {activeForm === 'tracking' && (
                                    <div className="form-container active" style={{ animation: 'fadeIn 0.4s ease' }}>
                                        <div className="card-header">
                                            <h2><i className='bx bx-search-alt'></i> Track Package</h2>
                                            <p>Non-registered customers can track here</p>
                                        </div>
                                        <form onSubmit={handleTrackPackage}>
                                            <div className="input-group">
                                                <i className='bx bx-box input-icon'></i>
                                                <input
                                                    type="text"
                                                    placeholder="Enter Tracking Number (e.g. SC12345678)"
                                                    required
                                                    autoComplete="off"
                                                    value={trackingNumber}
                                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                                />
                                                <button type="submit" className="primary-btn pulse-effect" disabled={isTracking}>
                                                    {isTracking ? (
                                                        <i className='bx bx-loader-alt bx-spin'></i>
                                                    ) : (
                                                        <>
                                                            <span>Track</span>
                                                            <i className='bx bx-right-arrow-alt'></i>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {trackingResult && (
                                                <div className="tracking-result">
                                                    <div className="tracking-status">
                                                        <div className="status-indicator"></div>
                                                        <span>{trackingResult.status}</span>
                                                    </div>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                                        <strong>ID:</strong> {trackingResult.id}
                                                    </p>
                                                    <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                        <i className='bx bx-map pin' style={{ color: 'var(--accent-color)' }}></i> Currently at {trackingResult.location}
                                                    </p>
                                                    <div style={{ marginTop: '1rem', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                                                        <div style={{ width: `${trackingResult.progress}%`, height: '100%', background: 'var(--success)', borderRadius: '2px' }}></div>
                                                    </div>
                                                </div>
                                            )}
                                        </form>

                                        <div className="divider">
                                            <span>OR</span>
                                        </div>

                                        <div className="login-prompt">
                                            <p>Have an account with us?</p>
                                            <button type="button" className="secondary-btn" onClick={() => setActiveForm('login')}>
                                                Login to Account
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Login Form */}
                                {activeForm === 'login' && (
                                    <div className="form-container" style={{ animation: 'fadeIn 0.4s ease' }}>
                                        <div className="card-header">
                                            <h2><i className='bx bx-user'></i> Welcome Back</h2>
                                            <p>Login to manage your shipments</p>
                                        </div>
                                        <form onSubmit={handleLogin}>
                                            <div className="form-control">
                                                <label htmlFor="username">Email or Username</label>
                                                <div className="input-wrapper">
                                                    <i className='bx bx-envelope input-icon'></i>
                                                    <input
                                                        type="text"
                                                        id="username"
                                                        placeholder="Enter your email"
                                                        required
                                                        autoComplete="username"
                                                        value={username}
                                                        onChange={(e) => setUsername(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-control">
                                                <label htmlFor="password">Password</label>
                                                <div className="input-wrapper">
                                                    <i className='bx bx-lock-alt input-icon'></i>
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        id="password"
                                                        placeholder="Enter your password"
                                                        required
                                                        autoComplete="current-password"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="eye-btn"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                    >
                                                        <i className={`bx ${showPassword ? 'bx-show' : 'bx-hide'}`}></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="form-actions">
                                                <label className="checkbox-container">
                                                    <input type="checkbox" id="rememberMe" />
                                                    <span className="checkmark"></span>
                                                    Remember me
                                                </label>
                                                <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setActiveForm('forgot'); }}>Forgot Password?</a>
                                            </div>
                                            <button
                                                type="submit"
                                                className="primary-btn full-width"
                                                disabled={isLoggingIn || loginSuccess}
                                                style={loginSuccess ? { background: 'var(--success)', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)' } : {}}
                                            >
                                                {isLoggingIn ? (
                                                    <><i className='bx bx-loader-alt bx-spin'></i> Logging in...</>
                                                ) : loginSuccess ? (
                                                    <><i className='bx bx-check'></i> Success</>
                                                ) : (
                                                    <>
                                                        <span>Login to Dashboard</span>
                                                        <i className='bx bx-log-in-circle'></i>
                                                    </>
                                                )}
                                            </button>
                                        </form>

                                        <div className="divider">
                                            <span>OR</span>
                                        </div>
                                        <div className="login-prompt">
                                            <p>Don't have an account?</p>
                                            <button type="button" className="secondary-btn" onClick={() => setActiveForm('register')}>
                                                Register Now
                                            </button>
                                        </div>

                                        <button type="button" className="back-btn" onClick={() => setActiveForm('tracking')}>
                                            <i className='bx bx-left-arrow-alt'></i> Back to Tracking
                                        </button>
                                    </div>
                                )}

                                {/* Forgot Password Form */}
                                {activeForm === 'forgot' && (
                                    <div className="form-container" style={{ animation: 'fadeIn 0.4s ease' }}>
                                        <div className="card-header">
                                            <h2><i className='bx bx-lock-open-alt'></i> Reset Password</h2>
                                            <p>Enter your details to reset your password</p>
                                        </div>
                                        <form onSubmit={handleResetPassword}>
                                            <div className="form-control">
                                                <label>Email</label>
                                                <div className="input-wrapper">
                                                    <i className='bx bx-envelope input-icon'></i>
                                                    <input
                                                        type="email"
                                                        placeholder="Enter your email"
                                                        required
                                                        value={forgotEmail}
                                                        onChange={(e) => setForgotEmail(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-control">
                                                <label>New Password</label>
                                                <div className="input-wrapper">
                                                    <i className='bx bx-lock-alt input-icon'></i>
                                                    <input
                                                        type="password"
                                                        placeholder="Enter new password"
                                                        required
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-control">
                                                <label>Confirm Password</label>
                                                <div className="input-wrapper">
                                                    <i className='bx bx-lock-alt input-icon'></i>
                                                    <input
                                                        type="password"
                                                        placeholder="Confirm new password"
                                                        required
                                                        value={confirmNewPassword}
                                                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="submit"
                                                className="primary-btn full-width"
                                                style={{ marginTop: '1rem', ...(resetSuccess ? { background: 'var(--success)', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)' } : {}) }}
                                                disabled={isResetting || resetSuccess}
                                            >
                                                {isResetting ? (
                                                    <><i className='bx bx-loader-alt bx-spin'></i> Resetting...</>
                                                ) : resetSuccess ? (
                                                    <><i className='bx bx-check'></i> Password Reset</>
                                                ) : (
                                                    <>
                                                        <span>Reset Password</span>
                                                        <i className='bx bx-check-circle'></i>
                                                    </>
                                                )}
                                            </button>
                                        </form>

                                        <button type="button" className="back-btn" onClick={() => setActiveForm('login')} style={{ marginTop: '1.5rem' }}>
                                            <i className='bx bx-left-arrow-alt'></i> Back to Login
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
            <Chatbot />
        </>
    );
}

export default App;
