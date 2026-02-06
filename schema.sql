-- Anonymous Campus Rumor Verification System
-- Database Schema

-- users table (APPEND-ONLY - never UPDATE/DELETE)
CREATE TABLE users (
    public_key TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    ip_hash TEXT  -- Daily rotating salt for rate limiting only
);

-- rumors table (hard delete when user chooses)
CREATE TABLE rumors (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT,
    creator_public_key TEXT REFERENCES users(public_key),
    created_at TIMESTAMP DEFAULT NOW(),
    deadline TIMESTAMP NOT NULL
);

-- votes table (IMMUTABLE unless rumor deleted)
CREATE TABLE votes (
    rumor_id INT REFERENCES rumors(id) ON DELETE CASCADE,
    voter_public_key TEXT REFERENCES users(public_key),
    vote_value BOOLEAN NOT NULL,
    voted_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY(rumor_id, voter_public_key)
);

-- reputation_cache (DISPOSABLE - recalculate from votes anytime)
CREATE TABLE reputation_cache (
    public_key TEXT PRIMARY KEY REFERENCES users(public_key),
    reputation FLOAT NOT NULL,
    last_calculated_at TIMESTAMP DEFAULT NOW()
);

-- finalized_scores (IMMUTABLE - prevents score manipulation after deadline)
CREATE TABLE finalized_scores (
    rumor_id INT PRIMARY KEY,
    trust_score FLOAT NOT NULL,
    total_votes INT NOT NULL,
    finalized_at TIMESTAMP DEFAULT NOW(),
    outcome BOOLEAN NOT NULL  -- TRUE/FALSE for reputation calculations
);

-- audit_log (PUBLIC blockchain-like transparency)
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    action_type TEXT NOT NULL,  -- 'REGISTER', 'SUBMIT', 'VOTE', 'DELETE', 'FINALIZE'
    actor_public_key TEXT,      -- NULL for system actions
    target_id TEXT,             -- rumor_id or reference
    data_hash TEXT NOT NULL,    -- SHA256 of action data
    timestamp TIMESTAMP DEFAULT NOW()
);

-- comments table (anonymous discussion on rumors)
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    rumor_id INT REFERENCES rumors(id) ON DELETE CASCADE,
    commenter_public_key TEXT REFERENCES users(public_key),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- indexes for performance
CREATE INDEX idx_rumors_deadline ON rumors(deadline);
CREATE INDEX idx_votes_rumor ON votes(rumor_id);
CREATE INDEX idx_votes_voter ON votes(voter_public_key);
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_finalized_rumor ON finalized_scores(rumor_id);
CREATE INDEX idx_comments_rumor ON comments(rumor_id);
