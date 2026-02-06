
import React, { useState } from 'react';
import { Send, User } from 'lucide-react';
import './CommentsSection.css';

const CommentsSection = ({ initialComments = [], onCommentAdded }) => {
    const [comments, setComments] = useState(initialComments);
    const [newComment, setNewComment] = useState("");

    // Update comments when initialComments changes
    React.useEffect(() => {
        setComments(initialComments);
    }, [initialComments]);

    const handlePost = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const updatedComments = [
            ...comments,
            {
                id: Date.now(),
                user: "You",
                text: newComment,
                time: "Just now"
            }
        ];
        
        setComments(updatedComments);
        if (onCommentAdded) {
            onCommentAdded(updatedComments);
        }
        setNewComment("");
    };

    return (
        <div className="comments-section swing-in">
            <div className="comments-list">
                {comments.map(c => (
                    <div key={c.id} className="comment-item">
                        <div className="comment-avatar">
                            <User size={14} />
                        </div>
                        <div className="comment-content">
                            <div className="comment-header">
                                <span className={`comment-user ${c.user === 'You' ? 'me' : ''} `}>{c.user}</span>
                                <span className="comment-time">{c.time}</span>
                            </div>
                            <p className="comment-text">{c.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <form className="comment-input-area" onSubmit={handlePost}>
                <input
                    type="text"
                    placeholder="Add to the discussion..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                />
                <button type="submit" disabled={!newComment.trim()}>
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

export default CommentsSection;
