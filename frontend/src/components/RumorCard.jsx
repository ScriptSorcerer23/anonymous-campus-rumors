import React, { useState } from 'react';
import { MessageSquare, Clock, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import CommentsSection from './CommentsSection';
import { vote as voteAPI, getStoredKeys, getRumorScore, deleteRumor } from '../services/api';
import './RumorCard.css';

const RumorCard = ({ humor, onVote, onDelete }) => {
    const [localVote, setLocalVote] = useState(null);
    const [showScore, setShowScore] = useState(humor.hasVoted || false);
    const [showComments, setShowComments] = useState(false);
    const [score, setScore] = useState(humor.initialScore || 50);
    const [voteCount, setVoteCount] = useState(humor.votes || 0);
    const [isExpired, setIsExpired] = useState(humor.isExpired || false);
    const [error, setError] = useState('');
    const [isVoting, setIsVoting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [comments, setComments] = useState(humor.commentData || []);
    const [commentCount, setCommentCount] = useState((humor.commentData || []).length);

    // Check expiration on mount
    React.useEffect(() => {
        if (humor.isExpired) {
            setIsExpired(true);
            setShowScore(true);
        }
    }, [humor.isExpired]);

    const handleVote = async (voteType) => {
        if (localVote || isExpired || isVoting) return;
        
        setIsVoting(true);
        setError('');

        try {
            const keys = getStoredKeys();
            if (!keys) {
                throw new Error('Please register first');
            }

            await voteAPI(keys.publicKey, keys.privateKey, humor.id, voteType === 'true');
            
            setLocalVote(voteType);
            setVoteCount(prev => prev + 1);
            
            // Fetch updated score after voting (pass our key for FR3.4)
            const scoreData = await getRumorScore(humor.id, keys.publicKey);
            setScore(Math.round(scoreData.trust_score));
            setShowScore(true);
            
            onVote && onVote(humor.id, voteType);
        } catch (err) {
            setError(err.message || 'Vote failed');
            setTimeout(() => setError(''), 3000);
        } finally {
            setIsVoting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to permanently delete this rumor? This action cannot be undone.')) return;
        
        setIsDeleting(true);
        setError('');

        try {
            const keys = getStoredKeys();
            if (!keys) {
                throw new Error('Please register first');
            }

            await deleteRumor(keys.publicKey, keys.privateKey, humor.id);
            
            onDelete && onDelete(humor.id);
        } catch (err) {
            setError(err.message || 'Delete failed');
            setTimeout(() => setError(''), 3000);
        } finally {
            setIsDeleting(false);
        }
    };

    // Check if current user is the creator
    const isOwnRumor = () => {
        const keys = getStoredKeys();
        return keys && humor.creatorKey === keys.publicKey;
    };

    const getTimeRemaining = () => {
        if (isExpired || !humor.deadline) return "Voting Closed";
        
        // Parse deadline properly - handle both timestamp and ISO string
        let deadlineTime;
        if (typeof humor.deadline === 'string') {
            deadlineTime = new Date(humor.deadline).getTime();
        } else {
            deadlineTime = humor.deadline;
        }
        
        const now = Date.now();
        const diff = deadlineTime - now;
        
        if (diff < 0) return "Voting Closed";

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours === 0) {
            return `${minutes}m left`;
        }
        return `${hours}h ${minutes}m left`;
    };

    // Dynamic Score Color
    const getScoreColor = (s) => {
        if (s >= 80) return 'var(--accent-green)'; // Verified
        if (s <= 20) return 'var(--accent-pink)'; // Debunked
        return 'var(--accent-cyan)'; // Uncertain
    };

    const TrustBar = ({ value }) => (
        <div className="trust-bar-container">
            <div className="trust-bar-bg">
                <div
                    className="trust-bar-fill"
                    style={{
                        width: `${value}%`,
                        backgroundColor: getScoreColor(value)
                    }}
                ></div>
            </div>
            <div className="trust-score-label" style={{ color: getScoreColor(value) }}>
                {value}% TRUST SCORE
            </div>
        </div>
    );

    return (
        <div className="rumor-card glass-panel">
            {error && <div style={{color: 'var(--accent-pink)', padding: '5px', fontSize: '12px'}}>❌ {error}</div>}
            <div className="rumor-header">
                <div className="rumor-meta">
                    <span className="rumor-id">ID: #{humor.id}</span>
                    {humor.category && (
                        <span className="rumor-category" style={{
                            background: 'rgba(0, 255, 255, 0.1)',
                            border: '1px solid rgba(0, 255, 255, 0.3)',
                            padding: '1px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: 'var(--accent-cyan, #00e5ff)',
                            marginLeft: '6px'
                        }}>
                            {humor.category}
                        </span>
                    )}
                    <span className={`rumor-time ${isExpired ? 'expired' : ''}`}>
                        <Clock size={14} /> {getTimeRemaining()}
                    </span>
                    {isOwnRumor() && (
                        <button 
                            className="delete-rumor-btn"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            title="Delete your rumor permanently"
                            style={{
                                background: 'rgba(244, 67, 54, 0.2)',
                                border: '1px solid rgba(244, 67, 54, 0.5)',
                                color: '#f44336',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                marginLeft: '8px'
                            }}
                        >
                            {isDeleting ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                    )}
                </div>
                <div className="voter-count">
                    {voteCount} voters
                </div>
            </div>

            <div className="rumor-content">
                <p>{humor.content}</p>
                {humor.image && (
                    <div className="rumor-image">
                        <img src={humor.image} alt="Rumor evidence" />
                    </div>
                )}
            </div>

            <div className={`rumor-actions ${isExpired ? 'expired-actions' : ''}`}>
                {!showScore && !isExpired ? (
                    <div className="vote-buttons">
                        <button
                            className={`vote-btn true-btn ${localVote === 'true' ? 'selected' : ''}`}
                            onClick={() => handleVote('true')}
                            disabled={!!localVote}
                        >
                            <ThumbsUp size={18} /> CONFIRM
                        </button>
                        <button
                            className={`vote-btn false-btn ${localVote === 'false' ? 'selected' : ''}`}
                            onClick={() => handleVote('false')}
                            disabled={!!localVote}
                        >
                            <ThumbsDown size={18} /> DISPUTE
                        </button>
                    </div>
                ) : (
                    <div className="vote-result swing-in">
                        {isExpired && (
                            <div className="final-verdict" style={{ color: getScoreColor(score) }}>
                                {score >= 80 ? "✅ OFFICIALLY VERIFIED" :
                                    score <= 20 ? "❌ OFFICIALLY DEBUNKED" :
                                        "⚠️ UNVERIFIED"}
                            </div>
                        )}
                        <TrustBar value={score} />
                        {!isExpired && (
                            <div className="vote-status">
                                {localVote === 'true' ? (
                                    <span className="status-badge confirm"><CheckCircle size={14} /> You Confirmed</span>
                                ) : (
                                    <span className="status-badge dispute"><XCircle size={14} /> You Disputed</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="rumor-footer">
                <button
                    className={`comment-trigger ${showComments ? 'active' : ''}`}
                    onClick={() => setShowComments(!showComments)}
                >
                    <MessageSquare size={16} />
                    {commentCount} Comments
                </button>

                <button className="report-trigger">
                    <AlertTriangle size={16} />
                </button>
            </div>

            {showComments && (
                <CommentsSection 
                    initialComments={comments} 
                    onCommentAdded={(newComments) => {
                        setComments(newComments);
                        setCommentCount(newComments.length);
                    }}
                />
            )}
        </div>
    );
};

export default RumorCard;
