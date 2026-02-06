import React, { useState, useEffect } from 'react';
import { Plus, Bell, Search, LogOut, CheckCircle, Flame, Clock } from 'lucide-react';
import RumorCard from '../components/RumorCard';
import CreatePostModal from '../components/CreatePostModal';
import { getRumors, getRumorScore } from '../services/api';
import './Feed.css';

const Feed = ({ userId, onLogout }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('trending');
    const [rumors, setRumors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Load rumors from backend
    useEffect(() => {
        loadRumors();
    }, []);

    const loadRumors = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getRumors();
            
            // Transform backend data to frontend format
            const transformedRumors = await Promise.all(data.map(async (rumor) => {
                console.log('Raw rumor from backend:', rumor);
                try {
                    const scoreData = await getRumorScore(rumor.id);
                    const deadlineTime = new Date(rumor.deadline).getTime();
                    const now = Date.now();
                    
                    console.log('Date conversion:', {
                        raw_deadline: rumor.deadline,
                        parsed_deadline: new Date(rumor.deadline),
                        deadline_timestamp: deadlineTime,
                        current_time: now,
                        diff_ms: deadlineTime - now,
                        diff_hours: (deadlineTime - now) / (1000 * 60 * 60)
                    });
                    
                    return {
                        id: rumor.id,
                        content: rumor.content,
                        creatorKey: rumor.creator_public_key,
                        votes: rumor.vote_count || 0,
                        initialScore: Math.round(scoreData.trust_score),
                        comments: 0,
                        commentData: [],
                        timestamp: new Date(rumor.created_at).getTime(),
                        deadline: deadlineTime,
                        isExpired: now > deadlineTime
                    };
                } catch {
                    return {
                        id: rumor.id,
                        content: rumor.content,
                        votes: rumor.vote_count || 0,
                        initialScore: 50,
                        comments: 0,
                        commentData: [],
                        timestamp: new Date(rumor.created_at).getTime(),
                        deadline: new Date(rumor.deadline).getTime(),
                        isExpired: new Date() > new Date(rumor.deadline)
                    };
                }
            }));
            
            setRumors(transformedRumors);
        } catch (err) {
            setError(err.message || 'Failed to load rumors');
        } finally {
            setLoading(false);
        }
    };

    const handleNewPost = async (postData) => {
        // Reload rumors after submission
        await loadRumors();
        setActiveTab('new');
    };

    const handleDeleteRumor = (rumorId) => {
        setRumors(prev => prev.filter(rumor => rumor.id !== rumorId));
    };

    const getFilteredRumors = () => {
        const now = Date.now();

        switch (activeTab) {
            case 'new':
                // Recently added, not expired
                return rumors.filter(r => !r.isExpired).sort((a, b) => b.timestamp - a.timestamp);
            case 'verified':
                // Expired items (results finalized)
                return rumors.filter(r => r.isExpired && r.initialScore >= 75);
            case 'trending':
            default:
                // Active items, sorted by votes
                return rumors.filter(r => !r.isExpired).sort((a, b) => b.votes - a.votes);
        }
    };

    return (
        <div className="feed-layout">
            <header className="feed-header glass-panel">
                <div className="header-left">
                    <h2 className="brand-logo neon-text">ACR</h2>
                </div>

                <div className="header-right">
                    <div className="transparency-links">
                        <a 
                            href="https://rumor-system-backend.onrender.com/api/audit/log" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="audit-link"
                            title="Public Audit Trail - Blockchain-like transparency"
                        >
                            🔗 Public Ledger
                        </a>
                    </div>
                    
                    <div className="user-badge">
                        <span className="user-label">ID:</span>
                        <span className="user-id">{userId}</span>
                    </div>
                    <button className="icon-btn" title="Notifications">
                        <Bell size={20} />
                        <span className="notification-dot"></span>
                    </button>
                    <button className="icon-btn" title="Logout" onClick={onLogout}>
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="feed-content container">
                {loading ? (
                    <div className="loading">Loading rumors...</div>
                ) : error ? (
                    <div className="error">{error}</div>
                ) : (
                    <>
                        <div className="feed-controls">
                            <div className="search-bar">
                                <Search size={18} className="search-icon" />
                                <input type="text" placeholder="Search rumors..." />
                            </div>
                            <div className="filter-tabs">
                                <button
                                    className={`filter-tab ${activeTab === 'trending' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('trending')}
                                >
                                    <Flame size={14} style={{ marginRight: 4 }} /> Trending
                                </button>
                                <button
                                    className={`filter-tab ${activeTab === 'new' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('new')}
                                >
                                    <Clock size={14} style={{ marginRight: 4 }} /> New
                                </button>
                                <button
                                    className={`filter-tab ${activeTab === 'verified' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('verified')}
                                >
                                    <CheckCircle size={14} style={{ marginRight: 4 }} /> Verified Results
                                </button>
                            </div>
                        </div>

                        <div className="rumor-list">
                            {getFilteredRumors().length > 0 ? (
                                getFilteredRumors().map(rumor => (
                                    <RumorCard 
                                        key={rumor.id} 
                                        humor={rumor} 
                                        onDelete={handleDeleteRumor}
                                    />
                                ))
                            ) : (
                                <div className="empty-state">No rumors in this category yet.</div>
                            )}
                        </div>
                    </>
                )}
            </main>

            <button
                className="fab-btn swing-in"
                onClick={() => setIsModalOpen(true)}
            >
                <Plus size={24} />
            </button>

            {isModalOpen && (
                <CreatePostModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleNewPost}
                />
            )}
        </div>
    );
};

export default Feed;
