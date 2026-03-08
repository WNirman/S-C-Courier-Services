import React, { useState } from 'react';

function App() {
    const [activeForm, setActiveForm] = useState('tracking'); // 'tracking' or 'login'
    const [showPassword, setShowPassword] = useState(false);

    // Tracking State
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [trackingResult, setTrackingResult] = useState(null);

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false);

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

    const handleLogin = (e) => {
        e.preventDefault();
        if (!username || !password) return;

        setIsLoggingIn(true);
        setLoginSuccess(false);

        setTimeout(() => {
            setIsLoggingIn(false);
            setLoginSuccess(true);

            setTimeout(() => {
                alert('Mock login successful!');
                setLoginSuccess(false);
                setUsername('');
                setPassword('');
            }, 1000);
        }, 1500);
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
                    <i className='bx bxs-truck'></i>
                    <span>SC Courier</span>
                </div>
                <button className="nav-login-btn" onClick={() => setActiveForm('login')}>
                    <i className='bx bx-user-circle'></i>
                    <span>Login</span>
                </button>
            </nav>

            <main className="container">
                <div className="main-content">
                    <div className="text-section">
                        <h1>Track Your <br /><span className="highlight">Delivery</span> Instantly</h1>
                        <p>Enter your tracking number below to get real-time updates on your package location and delivery status.</p>
                    </div>

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
                                        <a href="#" className="forgot-link">Forgot Password?</a>
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
                                <button type="button" className="back-btn" onClick={() => setActiveForm('tracking')}>
                                    <i className='bx bx-left-arrow-alt'></i> Back to Tracking
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}

export default App;
