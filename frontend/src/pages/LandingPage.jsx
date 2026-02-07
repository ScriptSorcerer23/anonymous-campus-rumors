import React, { useState, useEffect } from 'react';
import { Fingerprint, ArrowRight, UserPlus, Eye, EyeOff } from 'lucide-react';
import PuzzleCaptcha from '../components/PuzzleCaptcha';
import { generateKeyPair, computePoW, register, storeKeys, getStoredKeys } from '../services/api';
import './LandingPage.css';

const LandingPage = ({ onLogin }) => {
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [privateKeyDisplay, setPrivateKeyDisplay] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState('');
    const [registered, setRegistered] = useState(false);

    // Auto-login immediately if keys already exist
    useEffect(() => {
        const keys = getStoredKeys();
        if (keys) {
            onLogin(keys.publicKey);
        }
    }, []);

    const handleVerify = () => {
        setCaptchaVerified(true);
        // Double-check after captcha
        const keys = getStoredKeys();
        if (keys) {
            onLogin(keys.publicKey);
        }
    };

    const generateNewId = async () => {
        // Block if keys already exist
        const existingKeys = getStoredKeys();
        if (existingKeys) {
            onLogin(existingKeys.publicKey);
            return;
        }

        setIsGenerating(true);
        setError('');
        
        try {
            // Generate keys
            setProgress('Generating cryptographic keys...');
            const keys = generateKeyPair();
            
            // Compute proof of work
            setProgress('Computing proof-of-work (30-60 seconds)...');
            const pow = await computePoW(keys.publicKey);
            
            // Register with backend
            setProgress('Registering with network...');
            await register(keys.publicKey, pow.nonce);
            
            // Store keys permanently
            storeKeys(keys.publicKey, keys.privateKey);
            setPrivateKeyDisplay(keys.privateKey);
            setShowKey(false);
            setRegistered(true);
            setProgress('✅ Registration complete! SAVE YOUR PRIVATE KEY BELOW — then enter the feed.');
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const enterFeed = () => {
        const keys = getStoredKeys();
        if (keys) {
            onLogin(keys.publicKey);
        }
    };

    return (
        <div className="landing-container">
            <div className="hero-section">
                <h1 className="hero-title neon-text">Anonymous Campus</h1>
                <p className="hero-subtitle">Decentralized. Verified. Uncluttered.</p>
                <p className="hero-description">
                    The rumor verification protocol. Your voice, your vote, your privacy.
                </p>
            </div>

            <div className="auth-card glass-panel">
                {!captchaVerified ? (
                    <div className="captcha-step">
                        <h2 className="step-title">Verify Humanity</h2>
                        <PuzzleCaptcha onVerify={handleVerify} />
                    </div>
                ) : (
                    <div className="login-step fade-in">
                        <h2 className="step-title">Enter the Network</h2>

                        {progress && <p style={{color: 'var(--accent-cyan)', margin: '10px 0'}}>{progress}</p>}
                        {error && <p style={{color: 'var(--accent-pink)', margin: '10px 0'}}>❌ {error}</p>}

                        {registered && privateKeyDisplay ? (
                            <div className="key-display">
                                <p style={{fontSize: '12px', color: 'var(--accent-pink)', fontWeight: 'bold', marginBottom: '8px'}}>
                                    ⚠️ SAVE THIS KEY — it's your only way to recover your account on another device. You will NOT be shown this again.
                                </p>
                                <div className="input-group">
                                    <div className="icon-wrapper">
                                        <Fingerprint size={20} color="var(--accent-cyan)" />
                                    </div>
                                    <input
                                        type={showKey ? "text" : "password"}
                                        value={privateKeyDisplay}
                                        readOnly
                                        className="hash-input"
                                        onClick={(e) => { e.target.select(); navigator.clipboard?.writeText(privateKeyDisplay); }}
                                    />
                                    <button
                                        type="button"
                                        className="toggle-visibility"
                                        onClick={() => setShowKey(!showKey)}
                                    >
                                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <p style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px'}}>
                                    Click the key to copy it. Store it somewhere safe.
                                </p>

                                <button
                                    className="main-btn"
                                    onClick={enterFeed}
                                    style={{marginTop: '16px'}}
                                >
                                    Enter Feed <ArrowRight size={18} />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="secondary-btn"
                                onClick={generateNewId}
                                disabled={isGenerating}
                                style={{marginTop: '10px'}}
                            >
                                <UserPlus size={18} style={{ marginRight: '8px' }} />
                                {isGenerating ? progress || 'Generating...' : 'Generate New Identity'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="transparency-info glass-panel">
                <h3>🔗 Full Transparency</h3>
                <p>All actions are logged in a public audit trail for blockchain-like transparency.</p>
                <a 
                    href="https://rumor-system-backend.onrender.com/api/audit/log" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transparency-link"
                >
                    📋 View Public Audit Log
                </a>
                <div className="note">See all registrations, submissions, votes, and reputation changes</div>
            </div>

            <footer className="landing-footer">
                <p>Zero PII Stored. Cryptographically Secured.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
