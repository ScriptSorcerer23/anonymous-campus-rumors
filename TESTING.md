# Backend Testing Guide

## Prerequisites
- PostgreSQL installed and running
- Node.js installed

## Setup Steps

### 1. Create Database
```bash
# Open PostgreSQL command line (psql)
psql -U postgres

# Create database
CREATE DATABASE rumor_system;

# Connect to database
\c rumor_system

# Run schema (copy-paste from schema.sql)
```

### 2. Configure Environment
```bash
# Create .env file
cp .env.example .env

# Edit .env with your database credentials
DATABASE_URL=postgresql://postgres:yourpassword@localhost/rumor_system
PORT=5000
```

### 3. Start Server
```bash
npm start
# Should see: ✅ Database connected at: ...
# Should see: 🚀 Server running on port 5000
```

## Test Endpoints

### Test 1: User Registration
```bash
# This requires computing PoW in browser, so we'll skip for now
# Will test after frontend is built
```

### Test 2: Check Server Health
```bash
curl http://localhost:5000/api/rumors
# Should return: {"rumors":[]}
```

### Test 3: Audit Log
```bash
curl http://localhost:5000/api/audit/log
# Should return: {"logs":[],"count":0,"note":"..."}
```

## Manual Code Review Checklist

### ✅ Database Schema
- [ ] 6 tables defined (users, rumors, votes, reputation_cache, finalized_scores, audit_log)
- [ ] Proper foreign keys and CASCADE deletes
- [ ] Indexes on performance-critical columns

### ✅ Security
- [ ] PoW verification implemented
- [ ] Signature verification on all write operations
- [ ] IP rate limiting with daily rotation
- [ ] Probation period check (3 days)
- [ ] No SQL injection vulnerabilities (using parameterized queries)

### ✅ Core Features
- [ ] User registration with audit log
- [ ] Rumor submission with signature
- [ ] Voting with duplicate prevention
- [ ] Trust score calculation (weighted)
- [ ] Reputation system (exponential + recency)
- [ ] Finalization cron job
- [ ] Hard delete with cascade
- [ ] Public audit endpoints

### ✅ Anti-Manipulation
- [ ] Finalized scores are immutable
- [ ] Deleted rumors remove all votes
- [ ] Reputation cache invalidation works
- [ ] Must vote before seeing scores

### ✅ Code Quality
- [ ] All endpoints have error handling
- [ ] Database queries use async/await
- [ ] Functions are well-documented
- [ ] No hardcoded secrets
