import React, { useState } from 'react';
import { X, Send, Lock } from 'lucide-react';
import { submitRumor, getStoredKeys } from '../services/api';
import './CreatePostModal.css';

const CreatePostModal = ({ onClose, onSubmit }) => {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('general');
    const [eventType, setEventType] = useState('current'); // 'current' or 'future'
    const [customDeadline, setCustomDeadline] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Helper to format date for datetime-local input (in local timezone)
    const getLocalDateTimeString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        // Validate custom deadline if provided
        if (customDeadline) {
            const deadline = new Date(customDeadline);
            if (deadline <= new Date()) {
                setError('Deadline must be in the future');
                return;
            }
            if (deadline > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
                setError('Deadline cannot be more than 30 days in future');
                return;
            }
        }

        // Future events require custom deadline
        if (eventType === 'future' && !customDeadline) {
            setError('Future events require a custom deadline');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const keys = getStoredKeys();
            if (!keys) {
                throw new Error('No keys found. Please register first.');
            }

            // Convert datetime-local value to proper ISO string
            const deadlineToSend = customDeadline ? new Date(customDeadline).toISOString() : null;

            await submitRumor(keys.publicKey, keys.privateKey, content, category, eventType, deadlineToSend);
            
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

                    <div style={{margin: '15px 0'}}>
                        <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>
                            Category:
                        </label>
                        <select 
                            value={category} 
                            onChange={(e) => setCategory(e.target.value)}
                            style={{width: '100%', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'inherit', border: '1px solid rgba(255,255,255,0.1)'}}
                        >
                            <option value="general">General</option>
                            <option value="academic">Academic</option>
                            <option value="events">Events</option>
                            <option value="sports">Sports</option>
                            <option value="campus-life">Campus Life</option>
                            <option value="administration">Administration</option>
                        </select>
                    </div>

                    <div style={{margin: '15px 0'}}>
                        <label style={{display: 'block', marginBottom: '10px', fontWeight: 'bold'}}>
                            Event Type:
                        </label>
                        
                        <div style={{margin: '10px 0'}}>
                            <label style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}>
                                <input 
                                    type="radio" 
                                    value="current"
                                    checked={eventType === 'current'}
                                    onChange={(e) => setEventType(e.target.value)}
                                    style={{marginRight: '8px'}}
                                />
                                <strong>Current Event</strong> - Set custom deadline or auto-close in 3 days
                            </label>
                            
                            <label style={{display: 'flex', alignItems: 'center'}}>
                                <input 
                                    type="radio" 
                                    value="future"
                                    checked={eventType === 'future'}
                                    onChange={(e) => setEventType(e.target.value)}
                                    style={{marginRight: '8px'}}
                                />
                                <strong>Future Event</strong> - Custom deadline
                            </label>
                        </div>

                        {(eventType === 'future' || eventType === 'current') && (
                            <div style={{margin: '10px 0'}}>
                                <label style={{display: 'block', marginBottom: '5px'}}>
                                    {eventType === 'future' ? 'Event Date & Time:' : 'Custom Deadline (Optional):'}
                                </label>
                                <input 
                                    type="datetime-local" 
                                    value={customDeadline}
                                    onChange={(e) => setCustomDeadline(e.target.value)}
                                    min={getLocalDateTimeString(new Date(Date.now() + 60000))} // 1 min from now
                                    max={getLocalDateTimeString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))} // 30 days max
                                    style={{width: '100%', padding: '8px'}}
                                    required={eventType === 'future'}
                                />
                                <small style={{color: '#666', fontSize: '12px'}}>
                                    {eventType === 'future' 
                                        ? 'Voting will close at this date/time (your local time)'
                                        : 'Leave empty for automatic 3-day deadline'
                                    }
                                </small>
                            </div>
                        )}
                    </div>

                    <div className="modal-actions">
                        <div className="right-actions">
                            <span className="char-count">{content.length}/1000</span>
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={!content.trim() || isSubmitting || (eventType === 'future' && !customDeadline)}
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
