
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Loader, Camera, X, Image } from 'lucide-react';
import { getComments, postComment, getStoredKeys } from '../services/api';
import './CommentsSection.css';

const CommentsSection = ({ rumorId, onCommentCountUpdate }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [imageData, setImageData] = useState(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

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

    const compressImage = (file, maxWidth = 800, quality = 0.7) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            setTimeout(() => setError(''), 3000);
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            setError('Image too large (max 10MB before compression)');
            setTimeout(() => setError(''), 3000);
            return;
        }

        try {
            const compressed = await compressImage(file);
            setImagePreview(compressed);
            setImageData(compressed);
        } catch {
            setError('Failed to process image');
            setTimeout(() => setError(''), 3000);
        }
    };

    const removeImage = () => {
        setImagePreview(null);
        setImageData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handlePost = async (e) => {
        e.preventDefault();
        if ((!newComment.trim() && !imageData) || posting) return;

        const keys = getStoredKeys();
        if (!keys) {
            setError('Please register first');
            return;
        }

        setPosting(true);
        setError('');

        try {
            const result = await postComment(
                keys.publicKey, 
                keys.privateKey, 
                rumorId, 
                newComment.trim() || '', 
                imageData
            );
            setComments(prev => [...prev, result.comment]);
            if (onCommentCountUpdate) onCommentCountUpdate(comments.length + 1);
            setNewComment("");
            removeImage();
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
                                {c.content && <p className="comment-text">{c.content}</p>}
                                {c.image_url && (
                                    <div className="comment-image">
                                        <img src={c.image_url} alt="Comment attachment" onClick={(e) => {
                                            e.target.classList.toggle('expanded');
                                        }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {imagePreview && (
                <div className="image-preview-container">
                    <img src={imagePreview} alt="Preview" className="image-preview" />
                    <button className="remove-image-btn" onClick={removeImage} type="button">
                        <X size={14} />
                    </button>
                </div>
            )}

            <form className="comment-input-area" onSubmit={handlePost}>
                {/* Hidden file inputs */}
                <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                />

                <button 
                    type="button" 
                    className="camera-btn"
                    onClick={() => cameraInputRef.current?.click()}
                    title="Take a photo"
                    disabled={posting}
                >
                    <Camera size={16} />
                </button>
                <button 
                    type="button" 
                    className="gallery-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload image"
                    disabled={posting}
                >
                    <Image size={16} />
                </button>

                <input
                    type="text"
                    placeholder="Add to the discussion..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    maxLength={500}
                    disabled={posting}
                />
                <button type="submit" className="send-btn" disabled={(!newComment.trim() && !imageData) || posting}>
                    {posting ? <Loader size={16} className="spin" /> : <Send size={16} />}
                </button>
            </form>
        </div>
    );
};

export default CommentsSection;
