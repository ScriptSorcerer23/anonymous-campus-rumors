// Anonymous Campus Rumor Verification System - Backend Server
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nacl = require('tweetnacl');
const { decodeUTF8, decodeBase64 } = require('tweetnacl-util');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rumor_system',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Test database connection and ensure comments table exists
db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Database connected at:', res.rows[0].now);
        // Auto-create comments table if it doesn't exist
        db.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                rumor_id INT REFERENCES rumors(id) ON DELETE CASCADE,
                commenter_public_key TEXT REFERENCES users(public_key),
                content TEXT NOT NULL,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `).then(() => {
            db.query('CREATE INDEX IF NOT EXISTS idx_comments_rumor ON comments(rumor_id)').catch(() => {});
            // Add image_url column if table already existed without it
            db.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS image_url TEXT').catch(() => {});
        }).catch(e => console.error('Comments table creation error:', e.message));

        // Auto-create reputation_penalties table for persistent deletion penalties
        db.query(`
            CREATE TABLE IF NOT EXISTS reputation_penalties (
                id SERIAL PRIMARY KEY,
                public_key TEXT REFERENCES users(public_key),
                penalty NUMERIC NOT NULL,
                reason TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `).catch(e => console.error('Penalties table creation error:', e.message));
    }
});

// ==================== HELPER FUNCTIONS ====================

// Proof-of-work verification (FR7.1 - anti-bot)
function verifyPoW(publicKey, nonce, difficulty = 4) {
    const hash = crypto.createHash('sha256')
        .update(publicKey + nonce.toString())
        .digest('hex');
    return hash.startsWith('0'.repeat(difficulty));
}

// Hash IP with daily salt (NFR1.1 compliant, FR7.2 pattern detection)
function hashIP(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    const salt = new Date().toISOString().split('T')[0];
    return crypto.createHash('sha256').update(ip + salt).digest('hex').substring(0, 16);
}

// Signature verification (FR3.2 - cryptographic integrity)
function verifySignature(message, signature, publicKey) {
    try {
        return nacl.sign.detached.verify(
            decodeUTF8(message),
            decodeBase64(signature),
            decodeBase64(publicKey)
        );
    } catch {
        return false;
    }
}

// Check probation (1 minute for testing - adjustable)
function isPastProbation(createdAt) {
    return Date.now() - new Date(createdAt).getTime() >= 1 * 60 * 1000; // 60 seconds
}

// ==================== USER REGISTRATION ====================

// FR1: Anonymous Account Creation
app.post('/api/register', async (req, res) => {
    try {
        const { public_key, nonce } = req.body;
        const ipHash = hashIP(req);

        // FR7.2: Detect rapid account creation
        const recent = await db.query(
            'SELECT COUNT(*) FROM users WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
            [ipHash]
        );
        
        const difficulty = parseInt(recent.rows[0].count) > 2 ? 5 : 4; // FR7.3

        // FR7.1: Verify proof-of-work
        if (!verifyPoW(public_key, nonce, difficulty)) {
            return res.status(400).json({ error: 'Invalid proof-of-work', difficulty });
        }

        // FR1.3: Create without reputation (calculated on-demand)
        await db.query(
            'INSERT INTO users (public_key, ip_hash) VALUES ($1, $2)',
            [public_key, ipHash]
        );

        // Add to public audit log
        await db.query(
            'INSERT INTO audit_log (action_type, actor_public_key, data_hash) VALUES ($1, $2, $3)',
            ['REGISTER', public_key, crypto.createHash('sha256').update(public_key).digest('hex')]
        );

        res.json({ 
            success: true, 
            probation_end: new Date(Date.now() + 1 * 60 * 1000), // 1 minute
            message: 'Account created successfully! You can vote after 1 minute probation period.'
        });
    } catch (error) {
        res.status(400).json({ error: error.code === '23505' ? 'Already registered' : 'Registration failed' });
    }
});

// ==================== RUMOR SUBMISSION ====================

// FR2: Rumor Submission
app.post('/api/rumors', async (req, res) => {
    try {
        const { content, category, creator_public_key, event_type = 'current', custom_deadline, signature } = req.body;

        // Validate content length (max 1000 characters)
        if (!content || content.length === 0) {
            return res.status(400).json({ error: 'Content cannot be empty' });
        }
        if (content.length > 1000) {
            return res.status(400).json({ error: 'Content too long (max 1000 characters)' });
        }

        // FR2.3: Verify signature
        if (!verifySignature(`SUBMIT:${content}`, signature, creator_public_key)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // FR2.1: Calculate deadline based on event type
        let deadline;
        
        if (custom_deadline) {
            // User provided custom deadline (works for both current and future events)
            deadline = new Date(custom_deadline);
            
            // Validate deadline is in future
            if (deadline <= new Date()) {
                return res.status(400).json({ error: 'Deadline must be in the future' });
            }
            if (deadline > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
                return res.status(400).json({ error: 'Deadline cannot be more than 30 days in future' });
            }
        } else {
            // No custom deadline: auto-assign 3 days (72 hours)
            deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        }

        // FR8.1: Immutable voting window
        const result = await db.query(
            'INSERT INTO rumors (content, category, creator_public_key, deadline) VALUES ($1, $2, $3, $4) RETURNING id, created_at, deadline',
            [content, category, creator_public_key, deadline]
        );

        // Add to public audit log
        await db.query(
            'INSERT INTO audit_log (action_type, actor_public_key, target_id, data_hash) VALUES ($1, $2, $3, $4)',
            ['SUBMIT', creator_public_key, result.rows[0].id.toString(), crypto.createHash('sha256').update(content).digest('hex')]
        );

        res.json({ success: true, rumor: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Submission failed' });
    }
});

// ==================== VOTING ====================

// FR3: Voting Mechanism
app.post('/api/vote', async (req, res) => {
    try {
        const { rumor_id, voter_public_key, vote_value, signature } = req.body;

        // FR3.2: Verify signature
        if (!verifySignature(`VOTE:${rumor_id}:${vote_value}`, signature, voter_public_key)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Get user
        const userRes = await db.query('SELECT created_at FROM users WHERE public_key = $1', [voter_public_key]);
        if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
        
        const user = userRes.rows[0];

        // FR4.1: Check probation (1 minute for testing)
        if (!isPastProbation(user.created_at)) {
            const probationEnds = new Date(new Date(user.created_at).getTime() + 1 * 60 * 1000);
            return res.status(403).json({ 
                error: 'Account in probation period', 
                message: 'New accounts must wait 1 minute before voting',
                probation_ends: probationEnds,
                seconds_remaining: Math.max(0, Math.ceil((probationEnds.getTime() - Date.now()) / 1000))
            });
        }

        // Get rumor
        const rumorRes = await db.query('SELECT deadline FROM rumors WHERE id = $1', [rumor_id]);
        if (!rumorRes.rows[0]) return res.status(404).json({ error: 'Rumor not found' });
        
        const rumor = rumorRes.rows[0];

        // FR3.3: Check deadline
        if (Date.now() > new Date(rumor.deadline).getTime()) {
            return res.status(403).json({ error: 'Voting closed' });
        }

        // Check duplicate vote
        const existing = await db.query('SELECT 1 FROM votes WHERE rumor_id = $1 AND voter_public_key = $2', [rumor_id, voter_public_key]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Already voted' });
        }

        // FR3.2: Immutable vote (no reputation snapshot needed)
        await db.query(
            'INSERT INTO votes (rumor_id, voter_public_key, vote_value) VALUES ($1, $2, $3)',
            [rumor_id, voter_public_key, vote_value]
        );

        // Add to public audit log
        await db.query(
            'INSERT INTO audit_log (action_type, actor_public_key, target_id, data_hash) VALUES ($1, $2, $3, $4)',
            ['VOTE', voter_public_key, rumor_id.toString(), crypto.createHash('sha256').update(`${rumor_id}:${vote_value}`).digest('hex')]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Vote failed' });
    }
});

// ==================== TRUST SCORE CALCULATION ====================

// FR5: Trust Score Calculation
app.get('/api/rumors/:id/score', async (req, res) => {
    try {
        const { id } = req.params;
        const { voter_public_key } = req.query;

        // Check if score already finalized (prevents manipulation)
        const finalized = await db.query('SELECT trust_score, total_votes FROM finalized_scores WHERE rumor_id = $1', [id]);
        if (finalized.rows[0]) {
            return res.json({
                trust_score: finalized.rows[0].trust_score,
                vote_count: finalized.rows[0].total_votes,
                can_view: true,
                finalized: true
            });
        }

        // FR3.4: Must vote before seeing score
        if (voter_public_key) {
            const voted = await db.query(
                'SELECT 1 FROM votes WHERE rumor_id = $1 AND voter_public_key = $2',
                [id, voter_public_key]
            );
            if (voted.rows.length === 0) {
                return res.status(403).json({ error: 'Must vote first', can_view: false });
            }
        }

        // FR5.2: Simple vote count (unweighted for demo clarity)
        const votes = await db.query(
            'SELECT vote_value FROM votes WHERE rumor_id = $1',
            [id]
        );

        let trueCount = 0, falseCount = 0;
        for (const v of votes.rows) {
            v.vote_value ? trueCount++ : falseCount++;
        }

        // FR5.1: Score 0-100
        const total = trueCount + falseCount;
        const score = total > 0 ? (trueCount / total) * 100 : 50;

        res.json({ 
            trust_score: Math.round(score * 10) / 10,
            vote_count: votes.rows.length,
            can_view: true,
            finalized: false
        });
    } catch (error) {
        res.status(500).json({ error: 'Calculation failed' });
    }
});

// ==================== REPUTATION SYSTEM ====================

// Simple reputation calculation:
// Voter: +0.1 for correct vote, -0.1 for wrong vote
// Rumor creator: +0.2 if rumor verified TRUE, -0.2 if proven FALSE
async function getReputationAtTime(publicKey, asOfDate = new Date()) {
    // Check cache first (performance optimization)
    const cached = await db.query(
        'SELECT reputation, last_calculated_at FROM reputation_cache WHERE public_key = $1',
        [publicKey]
    );
    
    // Use cache if less than 1 minute old
    if (cached.rows[0] && (Date.now() - new Date(cached.rows[0].last_calculated_at).getTime() < 60 * 1000)) {
        return cached.rows[0].reputation;
    }

    let rep = 0;

    // 1) Voter reputation: +0.1 correct, -0.1 wrong (only finalized rumors)
    const votes = await db.query(
        `SELECT v.vote_value, f.outcome
         FROM votes v
         JOIN finalized_scores f ON v.rumor_id = f.rumor_id
         WHERE v.voter_public_key = $1`,
        [publicKey]
    );

    for (const vote of votes.rows) {
        if (vote.vote_value === vote.outcome) {
            rep += 0.1;  // Correct vote
        } else {
            rep -= 0.1;  // Wrong vote
        }
    }

    // 2) Creator reputation: +0.2 if rumor verified, -0.2 if debunked
    const createdRumors = await db.query(
        `SELECT f.outcome
         FROM rumors r
         JOIN finalized_scores f ON r.id = f.rumor_id
         WHERE r.creator_public_key = $1`,
        [publicKey]
    );

    for (const rumor of createdRumors.rows) {
        if (rumor.outcome === true) {
            rep += 0.2;  // Rumor was verified true
        } else {
            rep -= 0.2;  // Rumor was proven false
        }
    }

    // Round to 1 decimal place
    rep = Math.round(rep * 10) / 10;

    // 3) Add permanent penalties from deleted debunked rumors
    const penalties = await db.query(
        'SELECT COALESCE(SUM(penalty), 0) as total_penalty FROM reputation_penalties WHERE public_key = $1',
        [publicKey]
    );
    rep = Math.round((rep + parseFloat(penalties.rows[0].total_penalty)) * 10) / 10;

    // Update cache
    await db.query(
        'INSERT INTO reputation_cache (public_key, reputation) VALUES ($1, $2) ON CONFLICT (public_key) DO UPDATE SET reputation = $2, last_calculated_at = NOW()',
        [publicKey, rep]
    );

    return rep;
}

async function getRumorOutcome(rumorId) {
    const votes = await db.query(
        'SELECT vote_value FROM votes WHERE rumor_id = $1',
        [rumorId]
    );

    let trueCount = 0, falseCount = 0;
    for (const v of votes.rows) {
        v.vote_value ? trueCount++ : falseCount++;
    }

    return trueCount >= falseCount; // TRUE if majority says true
}

// ==================== FINALIZATION CRON JOB ====================

// FR5.3: Finalize scores on deadline
async function finalizeExpiredRumors() {
    const expired = await db.query(
        'SELECT id, creator_public_key FROM rumors WHERE deadline < NOW() AND id NOT IN (SELECT rumor_id FROM finalized_scores)'
    );

    for (const rumor of expired.rows) {
        const votes = await db.query(
            'SELECT vote_value, voter_public_key FROM votes WHERE rumor_id = $1',
            [rumor.id]
        );

        let trueCount = 0, falseCount = 0;
        for (const v of votes.rows) {
            v.vote_value ? trueCount++ : falseCount++;
        }

        const total = trueCount + falseCount;
        const score = total > 0 ? (trueCount / total) * 100 : 50;
        const outcome = trueCount >= falseCount;

        // Store finalized score (IMMUTABLE)
        await db.query(
            'INSERT INTO finalized_scores (rumor_id, trust_score, total_votes, outcome) VALUES ($1, $2, $3, $4)',
            [rumor.id, score, votes.rows.length, outcome]
        );

        // Invalidate cache for all voters AND the creator
        const affectedKeys = votes.rows.map(v => v.voter_public_key);
        if (rumor.creator_public_key && !affectedKeys.includes(rumor.creator_public_key)) {
            affectedKeys.push(rumor.creator_public_key);
        }
        if (affectedKeys.length > 0) {
            await db.query(
                'DELETE FROM reputation_cache WHERE public_key = ANY($1)',
                [affectedKeys]
            );
        }

        // Add to audit log
        await db.query(
            'INSERT INTO audit_log (action_type, target_id, data_hash) VALUES ($1, $2, $3)',
            ['FINALIZE', rumor.id.toString(), crypto.createHash('sha256').update(`finalize:${rumor.id}:${score}`).digest('hex')]
        );
    }
}

// Run every minute
setInterval(finalizeExpiredRumors, 60 * 1000);

// ==================== DELETION ====================

// FR6: Hard Deletion - User's Right to Erase
app.delete('/api/rumors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { creator_public_key, signature } = req.body;

        // FR2.3: Only creator can delete
        if (!verifySignature(`DELETE:${id}`, signature, creator_public_key)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const rumor = await db.query('SELECT creator_public_key FROM rumors WHERE id = $1', [id]);
        if (!rumor.rows[0]) {
            return res.status(404).json({ error: 'Rumor not found' });
        }
        if (rumor.rows[0].creator_public_key !== creator_public_key) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get finalized outcome before deletion (if exists)
        const finalized = await db.query('SELECT outcome FROM finalized_scores WHERE rumor_id = $1', [id]);
        const wasFinalized = finalized.rows.length > 0;
        const outcome = wasFinalized ? finalized.rows[0].outcome : null;

        // Get affected voters before deletion
        const voters = await db.query('SELECT DISTINCT voter_public_key FROM votes WHERE rumor_id = $1', [id]);

        // Add to audit log BEFORE deletion (transparency)
        await db.query(
            'INSERT INTO audit_log (action_type, actor_public_key, target_id, data_hash) VALUES ($1, $2, $3, $4)',
            ['DELETE', creator_public_key, id.toString(), crypto.createHash('sha256').update(`${id}:${signature}`).digest('hex')]
        );

        // Hard delete rumor (votes cascade delete automatically)
        await db.query('DELETE FROM rumors WHERE id = $1', [id]);
        
        // Delete finalized score
        await db.query('DELETE FROM finalized_scores WHERE rumor_id = $1', [id]);

        // Invalidate cache for all VOTERS so their rep recalculates WITHOUT this rumor
        if (voters.rows.length > 0) {
            await db.query(
                'DELETE FROM reputation_cache WHERE public_key = ANY($1)',
                [voters.rows.map(v => v.voter_public_key)]
            );
        }

        // Handle CREATOR reputation on deletion:
        // If rumor was finalized and outcome was FALSE (wrong rumor),
        // the creator's -0.2 penalty should STAY (not be recalculated away).
        // We do this by inserting a permanent penalty record.
        // If outcome was TRUE, the +0.2 bonus is naturally removed when
        // finalized_scores is deleted (recalculation won't find it).
        if (wasFinalized && outcome === false) {
            // Creator had a -0.2 penalty. The finalized_scores row is now deleted,
            // so recalculation would lose this penalty. We need to preserve it
            // by storing a permanent reputation adjustment.
            // We use reputation_cache to store a sticky penalty:
            // First recalculate without the deleted rumor, then subtract 0.2
            await db.query('DELETE FROM reputation_cache WHERE public_key = $1', [creator_public_key]);
            const freshRep = await getReputationAtTime(creator_public_key);
            const penalizedRep = Math.round((freshRep - 0.2) * 10) / 10;
            await db.query(
                'INSERT INTO reputation_cache (public_key, reputation) VALUES ($1, $2) ON CONFLICT (public_key) DO UPDATE SET reputation = $2, last_calculated_at = NOW()',
                [creator_public_key, penalizedRep]
            );
            // Also store in a permanent penalties table so it persists across recalculations
            await db.query(
                'INSERT INTO reputation_penalties (public_key, penalty, reason, created_at) VALUES ($1, $2, $3, NOW())',
                [creator_public_key, -0.2, `Deleted debunked rumor #${id}`]
            );
        } else {
            // Outcome was TRUE or not finalized: just invalidate creator cache
            // so bonus is recalculated away naturally
            await db.query('DELETE FROM reputation_cache WHERE public_key = $1', [creator_public_key]);
        }

        res.json({ 
            success: true, 
            message: 'Rumor permanently deleted. Reputations recalculated.',
            affected_voters: voters.rows.length 
        });
    } catch (error) {
        console.error('Deletion error:', error.message);
        res.status(500).json({ error: 'Deletion failed' });
    }
});

// ==================== PUBLIC AUDIT LOG ====================

// Public transparency - anyone can verify system integrity
app.get('/api/audit/log', async (req, res) => {
    try {
        const { since, limit } = req.query;
        
        const logs = await db.query(
            'SELECT action_type, actor_public_key, target_id, data_hash, timestamp FROM audit_log WHERE timestamp > $1 ORDER BY timestamp DESC LIMIT $2',
            [since || '1970-01-01', Math.min(parseInt(limit) || 100, 1000)]
        );

        res.json({ 
            logs: logs.rows,
            count: logs.rows.length,
            note: 'All actions are cryptographically verifiable'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// Get public reputation for any user (calculated on-the-fly)
app.get('/api/user/:publicKey/reputation', async (req, res) => {
    try {
        const { publicKey } = req.params;
        const reputation = await getReputationAtTime(publicKey, new Date());
        
        res.json({ 
            public_key: publicKey,
            reputation: Math.round(reputation * 10) / 10,
            note: 'Calculated from immutable vote history'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to calculate reputation' });
    }
});

// Get all active rumors
app.get('/api/rumors', async (req, res) => {
    try {
        const rumors = await db.query(
            `SELECT r.id, r.content, r.category, r.creator_public_key, r.created_at, r.deadline,
             COUNT(DISTINCT v.voter_public_key) as vote_count,
             COUNT(DISTINCT c.id) as comment_count
             FROM rumors r
             LEFT JOIN votes v ON r.id = v.rumor_id
             LEFT JOIN comments c ON r.id = c.rumor_id
             GROUP BY r.id ORDER BY r.created_at DESC`
        );
        res.json(rumors.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rumors' });
    }
});

// Get single rumor with details
app.get('/api/rumors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rumor = await db.query(
            'SELECT r.id, r.content, r.category, r.creator_public_key, r.created_at, r.deadline, COUNT(v.rumor_id) as vote_count FROM rumors r LEFT JOIN votes v ON r.id = v.rumor_id WHERE r.id = $1 GROUP BY r.id',
            [id]
        );
        
        if (!rumor.rows[0]) {
            return res.status(404).json({ error: 'Rumor not found' });
        }
        
        res.json({ rumor: rumor.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rumor' });
    }
});

// ==================== COMMENTS ====================

// Get comments for a rumor
app.get('/api/rumors/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await db.query(
            'SELECT id, rumor_id, commenter_public_key, content, image_url, created_at FROM comments WHERE rumor_id = $1 ORDER BY created_at ASC',
            [id]
        );
        res.json(comments.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Post a comment on a rumor
app.post('/api/rumors/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { commenter_public_key, content, signature, image_url } = req.body;

        if ((!content || content.trim().length === 0) && !image_url) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }
        if (content && content.length > 500) {
            return res.status(400).json({ error: 'Comment too long (max 500 characters)' });
        }
        // Validate image size (max ~2MB base64)
        if (image_url && image_url.length > 2800000) {
            return res.status(400).json({ error: 'Image too large (max 2MB)' });
        }

        // Verify signature (signature covers text content only)
        const signContent = content || '';
        if (!verifySignature(`COMMENT:${id}:${signContent}`, signature, commenter_public_key)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Check rumor exists
        const rumor = await db.query('SELECT id FROM rumors WHERE id = $1', [id]);
        if (!rumor.rows[0]) {
            return res.status(404).json({ error: 'Rumor not found' });
        }

        // Check user exists
        const user = await db.query('SELECT public_key FROM users WHERE public_key = $1', [commenter_public_key]);
        if (!user.rows[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await db.query(
            'INSERT INTO comments (rumor_id, commenter_public_key, content, image_url) VALUES ($1, $2, $3, $4) RETURNING id, rumor_id, commenter_public_key, content, image_url, created_at',
            [id, commenter_public_key, (content || '').trim(), image_url || null]
        );

        res.json({ success: true, comment: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

// API info endpoint - redirect to proper frontend
app.get('/', (req, res) => {
    res.json({
        service: 'Anonymous Campus Rumors API',
        version: '2.2',
        frontend: 'https://scriptsorcerer23.github.io/anonymous-campus-rumors/',
        api_base: '/api',
        endpoints: {
            'POST /api/register': 'Register new user account',
            'POST /api/rumors': 'Submit new rumor',
            'GET /api/rumors': 'Get all active rumors',
            'POST /api/vote': 'Vote on rumor truthfulness',
            'DELETE /api/rumors/:id': 'Delete own rumor',
            'GET /api/rumors/:id/comments': 'Get comments for a rumor',
            'POST /api/rumors/:id/comments': 'Post a comment on a rumor',
            'GET /api/user/:publicKey/reputation': 'Check user reputation'
        },
        message: 'Use the React frontend for the full experience!'
    });
});

// Temporary admin endpoint to reset finalized scores for re-finalization
app.post('/api/admin/reset-finalized', async (req, res) => {
    try {
        const { admin_key } = req.body;
        if (admin_key !== 'reset-2026-feb') return res.status(403).json({ error: 'Unauthorized' });
        await db.query('DELETE FROM finalized_scores');
        await db.query('DELETE FROM reputation_cache');
        const expired = await db.query('SELECT COUNT(*) FROM rumors WHERE deadline < NOW()');
        res.json({ success: true, message: 'Cleared all finalized scores and rep cache', expired_to_refinalize: expired.rows[0].count });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
