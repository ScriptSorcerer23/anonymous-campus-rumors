import React, { useState } from 'react';
import { Plus, Bell, Search, LogOut, CheckCircle, Flame, Clock } from 'lucide-react';
import RumorCard from '../components/RumorCard';
import CreatePostModal from '../components/CreatePostModal';
import './Feed.css';

const Feed = ({ userId, onLogout }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('trending'); // trending | new | verified

    // Mock Data
    const [rumors, setRumors] = useState([
        {
            id: "rm_8293",
            content: "The dean is planning to replace the old library coffee shop with a Starbucks next semester.",
            votes: 124,
            initialScore: 65,
            comments: 2,
            commentData: [
                { id: 1, user: "Anon #X92", text: "I heard this too from a TA.", time: "2h ago" },
                { id: 2, user: "Anon #B12", text: "Fake news. The cafe was just renovated.", time: "1h ago" }
            ],
            timestamp: Date.now() - 3600000 // 1 hr ago
        },
        {
            id: "rm_9921",
            content: "Hackathon winners will allegedly get direct internships at Google this year.",
            votes: 89,
            initialScore: 42,
            comments: 1,
            commentData: [
                { id: 3, user: "Anon #G55", text: "Google isn't even sponsoring this year.", time: "30m ago" }
            ],
            timestamp: Date.now() - 7200000 // 2 hrs ago
        },
        {
            id: "rm_1102",
            content: "Campus shuttle fees are increasing by 50% starting next month.",
            votes: 312,
            initialScore: 92, // Verified
            comments: 15,
            commentData: [],
            timestamp: Date.now() - (4 * 24 * 60 * 60 * 1000) // 4 days ago (Expired)
        },
        {
            id: "rm_3391",
            content: "There's a secret tunnel connecting the hostels to the main cafe.",
            votes: 450,
            initialScore: 12, // Debunked
            comments: 42,
            commentData: [],
            timestamp: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days ago (Expired)
        }
    ]);

    const handleNewPost = (postData) => {
        const newPost = {
            id: `rm_${Math.floor(Math.random() * 9000) + 1000}`,
            content: postData.content,
            votes: 0,
            initialScore: 50,
            comments: 0,
            commentData: [], // EMPTY comments for new post
            image: postData.image || (postData.hasImage ? "https://source.unsplash.com/random/800x600?campus" : null),
            timestamp: postData.timestamp
        };
        setRumors([newPost, ...rumors]);
        setActiveTab('new'); // Switch to new tab to see it
    };

    const getFilteredRumors = () => {
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        switch (activeTab) {
            case 'new':
                // Added recently, not expired
                return rumors.filter(r => (now - r.timestamp < threeDaysMs)).sort((a, b) => b.timestamp - a.timestamp);
            case 'verified':
                // Expired items (results public)
                return rumors.filter(r => (now - r.timestamp >= threeDaysMs));
            case 'trending':
            default:
                // Active items, sorted by votes
                return rumors.filter(r => (now - r.timestamp < threeDaysMs)).sort((a, b) => b.votes - a.votes);
        }
    };

    return (
        <div className="feed-layout">
            <header className="feed-header glass-panel">
                <div className="header-left">
                    <h2 className="brand-logo neon-text">ACR</h2>
                </div>

                <div className="header-right">
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
                            <RumorCard key={rumor.id} humor={rumor} />
                        ))
                    ) : (
                        <div className="empty-state">No rumors in this category yet.</div>
                    )}
                </div>
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
