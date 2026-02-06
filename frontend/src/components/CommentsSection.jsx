
import React, { useState, useEffect } from 'react';
import { Send, User, Loader } from 'lucide-react';
import { getComments, postComment, getStoredKeys } from '../services/api';
import './CommentsSection.css';

const CommentsSection = ({ rumorId, onCommentCountUpdate }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState('');

    // Load comments from backend
    useEffect(() => {
        loadComments();
    }, [rumorId]);

    const loadComments = async () => {
        try {
            setLoading(true);
            const data = await getComments(rumorId);
            setComments(data);
            if (onCommentCountUpdate) onCommentCountUpdate(data.length);
        } catch {
            setError('Failed to load comments');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const handlePost = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || posting) return;

        const keys = getStoredKeys();
        if (!keys) {
            setError('Please register first');
            return;
        }

        setPosting(true);
        setError('');

        try {
            const result = await postComment(keys.publicKey, keys.privateKey, rumorId, newComment.trim());
            setComments(prev => [...prev, result.comment]);
            if (onCommentCountUpdate) onCommentCountUpdate(comments.length + 1);
            setNewComment("");
        } catch (err) {
            setError(err.message || 'Failed to post comment');
            setTimeout(() => setError(''), 3000);
        } finally {
            setPosting(false);
        }
    };

    const isOwnComment = (commentKey) => {
        const keys = getStoredKeys();
        return keys && keys.publicKey === commentKey;
    };

    return (
        <div className="comments-section swing-in">
            {error && <div style={{color: 'var(--accent-pink)', fontSize: '12px', padding: '4px 8px'}}>❌ {error}</div>}
            
            <div className="comments-list">
                {loading ? (
                    <div style={{textAlign: 'center', padding: '10px', opacity: 0.5}}>Loading comments...</div>
                ) : comments.length === 0 ? (
                    <div style={{textAlign: 'center', padding: '10px', opacity: 0.5, fontSize: '13px'}}>No comments yet. Be the first!</div>
                ) : (
                    comments.map(c => (
                        <div key={c.id} className="comment-item">
                            <div className="comment-avatar">
                                <User size={14} />
                            </div>
                            <div className="comment-content">
                                <div className="comment-header">
                                    <span className={`comment-user ${isOwnComment(c.commenter_public_key) ? 'me' : ''}`}>
                                        {isOwnComment(c.commenter_public_key) ? 'You' : `Anon-${c.commenter_public_key.substring(0, 6)}`}
                                    </span>
                                    <span className="comment-time">{formatTime(c.created_at)}</span>
                                </div>
                                <p className="comment-text">{c.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form className="comment-input-area" onSubmit={handlePost}>
                <input
                    type="text"
                    placeholder="Add to the discussion..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    maxLength={500}
                    disabled={posting}
                />
                <button type="submit" disabled={!newComment.trim() || posting}>
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

export default CommentsSection;
