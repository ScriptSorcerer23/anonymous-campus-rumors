import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Feed from './pages/Feed';
import './App.css';

import { getStoredKeys } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-login if keys exist — no way to "log out"
    const keys = getStoredKeys();
    if (keys) {
      setUser(keys.publicKey);
    }
    setLoading(false);
  }, []);

  const handleLogin = (hashId) => {
    setUser(hashId);
  };

  if (loading) return null;

  return (
    <div className="app-layout">
      {!user ? (
        <LandingPage onLogin={handleLogin} />
      ) : (
        <Feed userId={user} />
      )}
    </div>
  );
}

export default App;
