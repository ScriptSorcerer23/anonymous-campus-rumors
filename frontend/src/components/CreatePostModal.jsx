import React, { useState } from 'react';
import { X, Send, Lock } from 'lucide-react';
import { submitRumor, getStoredKeys } from '../services/api';
import './CreatePostModal.css';

const CreatePostModal = ({ onClose, onSubmit }) => {
    const [content, setContent] = useState('');
    const [hoursUntilDeadline, setHoursUntilDeadline] = useState(24);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        setError('');

        try {
            const keys = getStoredKeys();
            if (!keys) {
                throw new Error('No keys found. Please register first.');
            }

            await submitRumor(keys.publicKey, keys.privateKey, content, hoursUntilDeadline);
            
            onSubmit({ content, timestamp: Date.now() });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to submit rumor');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel swing-in">
                <div className="modal-header">
                    <h3>New Anonymous Rumor</h3>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div style={{color: 'var(--accent-pink)', margin: '10px 0'}}>❌ {error}</div>}
                    
                    <textarea
                        placeholder="What's happening on campus? (Be accurate, reputation is at stake)"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        autoFocus
                        maxLength={1000}
                    />

                    <div style={{margin: '10px 0'}}>
                        <label style={{display: 'block', marginBottom: '5px'}}>
                            Deadline (hours from now):
                        </label>
                        <input 
                            type="number" 
                            value={hoursUntilDeadline}
                            onChange={(e) => setHoursUntilDeadline(parseInt(e.target.value))}
                            min="1"
                            max="720"
                            style={{width: '100px', padding: '5px'}}
                        />
                    </div>

                    <div className="modal-actions">
                        <div className="right-actions">
                            <span className="char-count">{content.length}/1000</span>
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={!content.trim() || isSubmitting}
                            >
                                {isSubmitting ? 'Signing & Submitting...' : (
                                    <>Submit <Send size={16} /></>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="security-note">
                        <Lock size={12} /> Cryptographically signed with your private key
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePostModal;
