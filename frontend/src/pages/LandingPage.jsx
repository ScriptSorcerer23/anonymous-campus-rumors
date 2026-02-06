import React, { useState } from 'react';
import { Fingerprint, ArrowRight, UserPlus, Eye, EyeOff } from 'lucide-react';
import PuzzleCaptcha from '../components/PuzzleCaptcha';
import './LandingPage.css';

const LandingPage = ({ onLogin }) => {
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [hashId, setHashId] = useState('');
    const [showId, setShowId] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleVerify = () => {
        setCaptchaVerified(true);
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (hashId.trim().length > 0) {
            onLogin(hashId);
        }
    };

    const generateNewId = () => {
        setIsGenerating(true);
        setTimeout(() => {
            // Mock Hash ID Generation
            const mockHash = 'anon_' + Math.random().toString(36).substr(2, 9);
            setHashId(mockHash);
            setIsGenerating(false);
            setShowId(true);
        }, 1500);
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

                        <form onSubmit={handleLogin} className="login-form">
                            <div className="input-group">
                                <div className="icon-wrapper">
                                    <Fingerprint size={20} color="var(--accent-cyan)" />
                                </div>
                                <input
                                    type={showId ? "text" : "password"}
                                    placeholder="Enter your Hash ID"
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

                            <button
                                type="submit"
                                className="main-btn"
                                disabled={!hashId}
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
                            {isGenerating ? 'Generating...' : 'Generate New Identity'}
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
