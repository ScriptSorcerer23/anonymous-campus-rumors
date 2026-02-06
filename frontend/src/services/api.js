// API Service for Backend Communication
const API_BASE = import.meta.env.PROD 
    ? 'https://rumor-system-backend.onrender.com/api' 
    : 'http://localhost:3000/api';

// Crypto helpers (browser-compatible)
import nacl from 'tweetnacl';
import { decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Key management
export const generateKeyPair = () => {
    const keyPair = nacl.sign.keyPair();
    return {
        publicKey: encodeBase64(keyPair.publicKey),
        privateKey: encodeBase64(keyPair.secretKey)
    };
};

export const getStoredKeys = () => {
    const publicKey = localStorage.getItem('publicKey');
    const privateKey = localStorage.getItem('privateKey');
    return publicKey && privateKey ? { publicKey, privateKey } : null;
};

export const storeKeys = (publicKey, privateKey) => {
    localStorage.setItem('publicKey', publicKey);
    localStorage.setItem('privateKey', privateKey);
};

export const clearKeys = () => {
    localStorage.removeItem('publicKey');
    localStorage.removeItem('privateKey');
};

// Proof of Work
export const computePoW = async (publicKey, difficulty = 4) => {
    const target = '0'.repeat(difficulty);
    let nonce = 0;

    while (true) {
        const data = publicKey + nonce.toString();
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (hash.startsWith(target)) {
            return { nonce, hash };
        }
        
        nonce++;
        
        // Update UI every 10k attempts
        if (nonce % 10000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
};

// Signature generation
export const signMessage = (message, privateKey) => {
    const privKeyBytes = decodeBase64(privateKey);
    const msgBytes = decodeUTF8(message);
    const signature = nacl.sign.detached(msgBytes, privKeyBytes);
    return encodeBase64(signature);
};

// API Calls
export const register = async (publicKey, nonce) => {
    const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: publicKey, nonce })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
    }
    
    return response.json();
};

export const submitRumor = async (publicKey, privateKey, content, category = 'general', eventType = 'current', customDeadline = null) => {
    const message = `SUBMIT:${content}`;
    const signature = signMessage(message, privateKey);
    
    const response = await fetch(`${API_BASE}/rumors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creator_public_key: publicKey,
            content,
            category,
            event_type: eventType,
            custom_deadline: customDeadline,
            signature
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit rumor');
    }
    
    return response.json();
};

export const getRumors = async () => {
    const response = await fetch(`${API_BASE}/rumors`);
    if (!response.ok) throw new Error('Failed to fetch rumors');
    return response.json();
};

export const getRumorScore = async (rumorId, voterPublicKey = null) => {
    let url = `${API_BASE}/rumors/${rumorId}/score`;
    if (voterPublicKey) {
        url += `?voter_public_key=${encodeURIComponent(voterPublicKey)}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch score');
    }
    return response.json();
};

export const vote = async (publicKey, privateKey, rumorId, voteValue) => {
    const message = `VOTE:${rumorId}:${voteValue}`;
    const signature = signMessage(message, privateKey);
    
    const response = await fetch(`${API_BASE}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            voter_public_key: publicKey,
            rumor_id: rumorId,
            vote_value: voteValue,
            signature
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
    }
    
    return response.json();
};

export const getReputation = async (publicKey) => {
    const response = await fetch(`${API_BASE}/user/${encodeURIComponent(publicKey)}/reputation`);
    if (!response.ok) throw new Error('Failed to fetch reputation');
    return response.json();
};

export const deleteRumor = async (publicKey, privateKey, rumorId) => {
    const message = `DELETE:${rumorId}`;
    const signature = signMessage(message, privateKey);
    
    const response = await fetch(`${API_BASE}/rumors/${rumorId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creator_public_key: publicKey,
            signature
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete rumor');
    }
    
    return response.json();
};
