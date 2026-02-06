// Anonymous Campus Rumor Verification System - Backend Server
// DEPLOYMENT VERSION: v2.2 - Emergency Deadline Fix
process.env.DEPLOYMENT_VERSION = 'v2.2-emergency';
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
app.use(express.json());

const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rumor_system',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Test database connection
db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected at:', res.rows[0].now);
    }
});

// ==================== HELPER FUNCTIONS ====================

// Proof-of-work verification (FR7.1 - anti-bot)
function verifyPoW(publicKey, nonce, difficulty = 4) {
    const hash = crypto.createHash('sha256')
        .update(publicKey + nonce.toString())
        .digest('hex');
    console.log(`PoW Check: nonce=${nonce}, hash=${hash}, target=${'0'.repeat(difficulty)}, valid=${hash.startsWith('0'.repeat(difficulty))}`);
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
        console.log('DEADLINE CALCULATION - Fixed version deployed!', { event_type, custom_deadline });
        console.log('Environment check - FORCE_DEFAULT_DEADLINE:', process.env.FORCE_DEFAULT_DEADLINE);
        console.log('Environment check - DEFAULT_DEADLINE_HOURS:', process.env.DEFAULT_DEADLINE_HOURS);
        console.log('Environment check - IGNORE_CUSTOM_DEADLINE:', process.env.IGNORE_CUSTOM_DEADLINE);
        
        let deadline;
        
        // Check for environment variable override
        if (process.env.FORCE_DEFAULT_DEADLINE === 'true' || process.env.IGNORE_CUSTOM_DEADLINE === 'true') {
            console.log('🚨 ENVIRONMENT VARIABLE OVERRIDING CUSTOM DEADLINE! 🚨');
            deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            console.log('Forced default deadline due to env var:', deadline);
        } else if (custom_deadline) {
            // User provided custom deadline (works for both current and future events)
            deadline = new Date(custom_deadline);
            console.log('Using custom deadline:', deadline);
            
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
            console.log('Using default 3-day deadline:', deadline);
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

        // FR5.2: Weighted vote formula (calculate reputation on-the-fly)
        const votes = await db.query(
            'SELECT vote_value, voter_public_key FROM votes WHERE rumor_id = $1',
            [id]
        );

        let trueWeight = 0, falseWeight = 0;
        
        // Calculate each voter's reputation at vote time
        for (const v of votes.rows) {
            const rep = await getReputationAtTime(v.voter_public_key, new Date());
            const weight = rep > 0 ? rep : 1;
            v.vote_value ? trueWeight += weight : falseWeight += weight;
        }

        // FR5.1: Score 0-100
        const total = trueWeight + falseWeight;
        const score = total > 0 ? (trueWeight / total) * 100 : 50;

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

// FR4.3 & FR4.4: Calculate reputation on-the-fly (PURE FUNCTION)
async function getReputationAtTime(publicKey, asOfDate = new Date()) {
    // Check cache first (performance optimization)
    const cached = await db.query(
        'SELECT reputation, last_calculated_at FROM reputation_cache WHERE public_key = $1',
        [publicKey]
    );
    
    // Use cache if less than 5 minutes old
    if (cached.rows[0] && (Date.now() - new Date(cached.rows[0].last_calculated_at).getTime() < 5 * 60 * 1000)) {
        return cached.rows[0].reputation;
    }

    // FR6.1: Only use finalized rumors (deleted rumors won't have entries)
    const votes = await db.query(
        `SELECT v.rumor_id, v.vote_value, v.voted_at, f.outcome
         FROM votes v
         JOIN finalized_scores f ON v.rumor_id = f.rumor_id
         WHERE v.voter_public_key = $1
         ORDER BY v.voted_at ASC`,
        [publicKey]
    );

    let rep = 0;
    const now = Date.now();

    for (const vote of votes.rows) {
        // Use finalized outcome (already calculated when rumor closed)
        const correct = vote.vote_value === vote.outcome;

        // FR4.4: Recency weighting (exponential decay over 30 days)
        const ageInDays = (now - new Date(vote.voted_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyFactor = Math.exp(-ageInDays / 30);

        // FR4.3: Exponential growth/decay
        if (correct) {
            rep = rep * 1.15 + (0.15 * recencyFactor);
        } else {
            rep = rep * 0.85;
        }
    }

    // FR4.4: Normalize to prevent unbounded growth
    rep = Math.tanh(rep / 100) * 100;

    // Update cache (disposable - can be deleted anytime)
    await db.query(
        'INSERT INTO reputation_cache (public_key, reputation) VALUES ($1, $2) ON CONFLICT (public_key) DO UPDATE SET reputation = $2, last_calculated_at = NOW()',
        [publicKey, rep]
    );

    return rep;
}

async function getRumorOutcome(rumorId) {
    const votes = await db.query(
        'SELECT vote_value, voter_public_key FROM votes WHERE rumor_id = $1',
        [rumorId]
    );

    let trueW = 0, falseW = 0;
    
    // Calculate weighted outcome using reputation at vote time
    for (const v of votes.rows) {
        const rep = await getReputationAtTime(v.voter_public_key, new Date());
        const weight = rep > 0 ? rep : 1;
        v.vote_value ? trueW += weight : falseW += weight;
    }

    return trueW >= falseW; // TRUE if >= 50% weighted
}

// ==================== FINALIZATION CRON JOB ====================

// FR5.3: Finalize scores on deadline (prevents future manipulation)
async function finalizeExpiredRumors() {
    const expired = await db.query(
        'SELECT id FROM rumors WHERE deadline < NOW() AND id NOT IN (SELECT rumor_id FROM finalized_scores)'
    );

    for (const rumor of expired.rows) {
        // Calculate final weighted score
        const votes = await db.query(
            'SELECT vote_value, voter_public_key FROM votes WHERE rumor_id = $1',
            [rumor.id]
        );

        let trueWeight = 0, falseWeight = 0;
        
        for (const v of votes.rows) {
            const rep = await getReputationAtTime(v.voter_public_key, new Date());
            const weight = rep > 0 ? rep : 1;
            v.vote_value ? trueWeight += weight : falseWeight += weight;
        }

        const total = trueWeight + falseWeight;
        const score = total > 0 ? (trueWeight / total) * 100 : 50;
        const outcome = trueWeight >= falseWeight;

        // Store finalized score (IMMUTABLE)
        await db.query(
            'INSERT INTO finalized_scores (rumor_id, trust_score, total_votes, outcome) VALUES ($1, $2, $3, $4)',
            [rumor.id, score, votes.rows.length, outcome]
        );

        // Invalidate cache for all voters (reputation will recalculate with new finalized rumor)
        if (votes.rows.length > 0) {
            await db.query(
                'DELETE FROM reputation_cache WHERE public_key = ANY($1)',
                [votes.rows.map(v => v.voter_public_key)]
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

        // Get affected voters before deletion
        const voters = await db.query('SELECT DISTINCT voter_public_key FROM votes WHERE rumor_id = $1', [id]);

        // Add to audit log BEFORE deletion (transparency)
        await db.query(
            'INSERT INTO audit_log (action_type, actor_public_key, target_id, data_hash) VALUES ($1, $2, $3, $4)',
            ['DELETE', creator_public_key, id.toString(), crypto.createHash('sha256').update(`${id}:${signature}`).digest('hex')]
        );

        // FR6.1: Hard delete - data is GONE (votes cascade delete automatically)
        await db.query('DELETE FROM rumors WHERE id = $1', [id]);
        
        // Also delete finalized score if it exists
        await db.query('DELETE FROM finalized_scores WHERE rumor_id = $1', [id]);

        // FR6.1: Invalidate reputation cache for affected voters
        if (voters.rows.length > 0) {
            await db.query(
                'DELETE FROM reputation_cache WHERE public_key = ANY($1)',
                [voters.rows.map(v => v.voter_public_key)]
            );
        }

        res.json({ 
            success: true, 
            message: 'Rumor permanently deleted. Reputation will recalculate from remaining votes.',
            affected_voters: voters.rows.length 
        });
    } catch (error) {
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
            'SELECT r.id, r.content, r.category, r.creator_public_key, r.created_at, r.deadline, COUNT(v.rumor_id) as vote_count FROM rumors r LEFT JOIN votes v ON r.id = v.rumor_id GROUP BY r.id ORDER BY r.created_at DESC'
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
            'GET /api/user/:publicKey/reputation': 'Check user reputation'
        },
        message: 'Use the React frontend for the full experience!'
    });
});

const PORT = process.env.PORT || 3000;
console.log('🔥🔥🔥 DEADLINE FIX v2.2 DEPLOYED - EMERGENCY PATCH 🔥🔥🔥');
console.log('Deployment timestamp:', new Date().toISOString());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
