import React, { useState } from 'react';
import { Fingerprint, ArrowRight, UserPlus, Eye, EyeOff } from 'lucide-react';
import PuzzleCaptcha from '../components/PuzzleCaptcha';
import { generateKeyPair, computePoW, register, storeKeys, getStoredKeys } from '../services/api';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import nacl from 'tweetnacl';
import './LandingPage.css';

const LandingPage = ({ onLogin }) => {
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [hashId, setHashId] = useState('');
    const [showId, setShowId] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState('');

    const handleVerify = () => {
        setCaptchaVerified(true);
        // Check if user already has keys
        const keys = getStoredKeys();
        if (keys) {
            // Auto-login if keys exist
            onLogin(keys.publicKey);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (hashId.trim().length === 0) return;
        
        try {
            // User is pasting their private key to login
            // Derive public key from private key
            const privKeyBytes = decodeBase64(hashId);
            const keyPair = nacl.sign.keyPair.fromSecretKey(privKeyBytes);
            const publicKey = encodeBase64(keyPair.publicKey);
            
            // Store both keys
            storeKeys(publicKey, hashId);
            onLogin(publicKey);
        } catch (err) {
            setError('Invalid private key format');
        }
    };

    const generateNewId = async () => {
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
            
            // Store keys
            storeKeys(keys.publicKey, keys.privateKey);
            setHashId(keys.privateKey);
            setShowId(false); // Hidden by default - user must toggle to see
            setProgress('✅ Registration complete! SAVE YOUR PRIVATE KEY BELOW!');
            
            setTimeout(() => setProgress(''), 2000);
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsGenerating(false);
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

                        <form onSubmit={handleLogin} className="login-form">
                            <div className="input-group">
                                <div className="icon-wrapper">
                                    <Fingerprint size={20} color="var(--accent-cyan)" />
                                </div>
                                <input
                                    type={showId ? "text" : "password"}
                                    placeholder="Paste your PRIVATE KEY to login"
                                    value={hashId}
                                    onChange={(e) => setHashId(e.target.value)}
                                    className="hash-input"
                                />
                                <button
                                    type="button"
                                    className="toggle-visibility"
                                    onClick={() => setShowId(!showId)}
                                >
                                    {showId ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            
                            {hashId && (
                                <p style={{fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '5px'}}>
                                    🔐 This is your PRIVATE KEY. Never share it!
                                </p>
                            )}

                            <button
                                type="submit"
                                className="main-btn"
                                disabled={!hashId || isGenerating}
                            >
                                Connect <ArrowRight size={18} />
                            </button>
                        </form>

                        <div className="divider">
                            <span>OR</span>
                        </div>

                        <button
                            className="secondary-btn"
                            onClick={generateNewId}
                            disabled={isGenerating}
                        >
                            <UserPlus size={18} style={{ marginRight: '8px' }} />
                            {isGenerating ? progress || 'Generating...' : 'Generate New Identity'}
                        </button>
                    </div>
                )}
            </div>

            <footer className="landing-footer">
                <p>Zero PII Stored. Cryptographically Secured.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
