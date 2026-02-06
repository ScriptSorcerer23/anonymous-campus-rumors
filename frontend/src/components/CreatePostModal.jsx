import React, { useState } from 'react';
import { X, Image, Send, Lock, Trash2 } from 'lucide-react';
import './CreatePostModal.css';

const CreatePostModal = ({ onClose, onSubmit }) => {
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);

        // Simulate network request
        setTimeout(() => {
            onSubmit({
                content,
                hasImage: !!imageFile,
                image: previewUrl, // Pass the blob URL for immediate display
                timestamp: Date.now()
            });
            setIsSubmitting(false);
            onClose();
        }, 1000);
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
                    <textarea
                        placeholder="What's happening on campus? (Be accurate, reputation is at stake)"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        autoFocus
                        maxLength={280}
                    />

                    {previewUrl && (
                        <div className="image-preview-container">
                            <img src={previewUrl} alt="Preview" className="image-preview" />
                            <button type="button" className="remove-image-btn" onClick={removeImage}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}

                    <div className="modal-actions">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            className={`action-btn ${previewUrl ? 'active' : ''}`}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <Image size={18} /> {previewUrl ? 'Change Evidence' : 'Add Evidence'}
                        </button>

                        <div className="right-actions">
                            <span className="char-count">{content.length}/280</span>
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={!content.trim() || isSubmitting}
                            >
                                {isSubmitting ? 'Encryping...' : (
                                    <>Submit <Send size={16} /></>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="security-note">
                        <Lock size={12} /> Signed & Anonymized with your Hash ID
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePostModal;
