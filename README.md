Live on: https://scriptsorcerer23.github.io/anonymous-campus-rumors/

# Anonymous Campus Rumor Verification System

## 1. Project Overview

An anonymous, decentralized campus news and rumor verification platform designed to combat misinformation without compromising user privacy. The system enables students to submit, verify, and dispute campus-related information through a reputation-based voting mechanism that rewards accuracy and penalizes unreliable participants—all while maintaining complete anonymity.

Unlike traditional social platforms where popularity drives visibility, this system uses a **trust score mechanism** weighted by individual voter reputation, ensuring that factual accuracy supersedes mere popularity. The platform operates without central administrative control over truth determination, relying instead on collective intelligence and time-gated reputation building.

### Key Principles
- **Anonymity First**: No identity collection or verification
- **Decentralized Truth**: Community-driven verification without admin bias
- **Reputation-Weighted Voting**: Voting power earned through accuracy over time
- **Anti-Sybil Design**: Time-cost barriers prevent mass bot manipulation
- **Temporal Accountability**: Time-bounded voting periods with locked decisions

---

## 2. Problem Analysis

### 2.1 Core Challenges

#### Challenge 1: Anonymous Identity Verification
**Problem**: Enable anonymous participation while preventing single users from voting multiple times.

**Conflict**: Traditional identity verification contradicts anonymity requirements. Standard solutions (email verification, student IDs) compromise privacy.

**Impact**: Without controls, malicious actors can create unlimited accounts (Sybil attack) to manipulate rumor scores.

---

#### Challenge 2: Truth Without Central Authority
**Problem**: Determine factual accuracy through distributed consensus without an authoritative admin deciding truth.

**Conflict**: Removing central authority opens the door to coordinated manipulation by organized groups spreading false narratives.

**Impact**: The system must mathematically prevent coordinated liars from overpowering honest participants.

---

#### Challenge 3: Popularity vs. Accuracy
**Problem**: Popular false rumors (believed by many) must not automatically win verification.

**Conflict**: Simple voting systems favor majority opinion regardless of truth. High engagement on false information skews results.

**Impact**: Without correction mechanisms, viral misinformation dominates factual content.

---

#### Challenge 4: Bot Account Manipulation
**Problem**: Automated bot accounts can flood the system with coordinated votes.

**Conflict**: Anonymity requirements prevent traditional anti-bot measures like CAPTCHA at every action or phone verification.

**Impact**: Bot farms can manipulate trust scores at scale if unrestricted.

---

#### Challenge 5: Deleted Content Integrity
**Problem**: When rumors are deleted, their historical impact on user reputation scores persists, creating inconsistencies.

**Bug Example**: User A votes correctly on Rumor X, gains reputation. Rumor X gets deleted weeks later. User A's enhanced voting power (derived from deleted rumor) now affects unrelated Rumor Y.

**Impact**: Deleted content creates "ghost reputation" that can't be traced or validated.

---

#### Challenge 6: Dynamic Score Stability
**Problem**: Old verified facts may need re-evaluation as new information emerges, but score changes must be transparent.

**Conflict**: Static scores ignore evolving truth; dynamic scores create uncertainty and potential manipulation vectors.

**Impact**: Users lose trust if scores change unpredictably or without clear justification.

---

#### Challenge 7: Game-Theoretic Attacks
**Problem**: Coordinated groups could strategically vote to maximize their collective reputation while spreading misinformation.

**Mathematical Challenge**: Prove the system resists collusion even when:
- Attackers control 30-40% of participants
- Attackers can create unlimited new accounts
- No central authority can ban malicious users

---

## 3. Functional Requirements and our Proposed Solution

### FR1: Anonymous Account Creation
- **FR1.1**: Users shall generate cryptographic key pairs (public/private) locally without providing identity information.
- **FR1.2**: The system shall accept unlimited account registrations without rate limiting or verification.
- **FR1.3**: Newly created accounts shall be assigned default minimal reputation (reputation = 0).

### FR2: Rumor Submission
- **FR2.1**: Users shall submit rumors anonymously with two type classifications:
  - **Future Event**: User-specified expiration date for voting closure
  - **Current Event**: Auto-assigned 3-day voting window from submission time
- **FR2.2**: Each rumor shall include:
  - Textual content (statement to be verified)
  - Category tag (optional)
  - Timestamp of creation
  - Voting deadline
- **FR2.3**: Only the original submitter (via cryptographic signature) shall delete their rumor.

### FR3: Voting Mechanism
- **FR3.1**: Users shall vote TRUE or FALSE on active (non-expired) rumors.
- **FR3.2**: Votes shall be:
  - **Immutable**: Cannot be changed or retracted after submission
  - **Cryptographically signed**: Verifiable without revealing identity
  - **Weighted**: Multiplied by voter's current reputation score
- **FR3.3**: Users cannot vote on expired rumors (past deadline).
- **FR3.4**: Users cannot see aggregated results/trust scores until AFTER they cast their vote.

### FR4: Reputation System
- **FR4.1**: New accounts enter a **3-day probation period** where voting is disabled.
- **FR4.2**: After probation, users gain **basic voting rights** with low initial vote weight.
- **FR4.3**: Reputation adjusts dynamically based on voting accuracy:
  - **Reward**: Exponential increase for voting with eventual majority/verified outcome
  - **Penalty**: Exponential decrease for voting against eventual outcome
- **FR4.4**: Reputation calculation formula shall:
  - Use exponential growth/decay (e.g., reputation *= e^(accuracy_factor))
  - Consider recency (recent votes weighted more than historical)
  - Normalize to prevent unbounded growth

### FR5: Trust Score Calculation
- **FR5.1**: Each rumor receives a **trust score** between 0-100:
  - 0 = Verified FALSE
  - 100 = Verified TRUE
  - 50 = Uncertain/Contested
- **FR5.2**: Trust score calculated as:
  ```
  Trust Score = (Σ weighted_votes_TRUE) / (Σ weighted_votes_TRUE + Σ weighted_votes_FALSE) * 100
  ```
  where weighted_vote = user_reputation * vote_direction
- **FR5.3**: Trust scores finalize upon voting deadline expiration.

### FR6: Deletion Handling
- **FR6.1**: When a rumor is deleted:
  - All associated votes shall be discarded
  - The rumor shall be excluded from ALL reputation calculations (past and future)
  - User reputations shall be **recalculated** using only non-deleted rumor voting history
- **FR6.2**: Deleted rumors shall not appear in search, feeds, or historical records.
- **FR6.3**: Deletion action shall be logged cryptographically for audit purposes (without revealing user identity).

### FR7: Anti-Bot Protection
- **FR7.1**: Landing page shall implement CAPTCHA/proof-of-work puzzle before account creation.
- **FR7.2**: System shall detect rapid account creation from similar behavioral patterns.
- **FR7.3**: Bot detection triggers additional proof-of-work requirements (e.g., computation puzzles).

### FR8: Temporal Locking
- **FR8.1**: Voting windows are immutable after rumor creation.
- **FR8.2**: Extended deadlines are NOT permitted to prevent manipulation.
- **FR8.3**: System time source shall be distributed consensus (blockchain timestamp or similar) to prevent server-side manipulation.

---

## 4. Non-Functional Requirements (NFRs)

### NFR1: Security & Privacy
- **NFR1.1**: **Anonymity Guarantee**: The system shall not log, store, or correlate user IP addresses, device fingerprints, or identifying metadata with votes/rumors.
- **NFR1.2**: **Cryptographic Integrity**: All votes and rumors shall use digital signatures (e.g., Ed25519) for authentication without identity exposure.
- **NFR1.3**: **Resistance to Timing Attacks**: Vote submission timestamps shall use obfuscation (e.g., batched processing) to prevent correlation attacks.

### NFR2: Performance
- **NFR2.1**: Trust score calculations shall complete within **5 seconds** for rumors with up to 500 votes.
- **NFR2.2**: Reputation recalculation after deletion shall process within **30 seconds** for users with up to 200 vote history records.
- **NFR2.3**: System shall support **500 concurrent users** with acceptable response times (under 3 seconds).

### NFR3: Scalability
- **NFR3.1**: Database design shall support basic indexing on timestamps and user IDs for efficient querying.

### NFR4: Reliability
- **NFR4.1**: **Uptime**: 95% availability during testing and initial deployment.
- **NFR4.2**: **Data Persistence**: Votes and rumors shall be stored persistently to prevent data loss.
- **NFR4.3**: Basic error handling and logging for debugging purposes.

### NFR5: Usability
- **NFR5.1**: Interface shall be intuitive with clear instructions for voting mechanics.
  
### NFR6: Maintainability
- **NFR6.1**: Code shall be organized with clear separation of concerns.

### NFR7: Privacy
- **NFR7.1**: No storage of personally identifiable information (PII) in any database.
- **NFR7.2**: Users maintain control of their cryptographic keys locally.
---
