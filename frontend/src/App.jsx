import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Feed from './pages/Feed';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for existing session
    const storedUser = localStorage.getItem('acr_user_id');
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (hashId) => {
    localStorage.setItem('acr_user_id', hashId);
    setUser(hashId);
  };

  const handleLogout = () => {
    localStorage.removeItem('acr_user_id');
    setUser(null);
  };

  if (loading) return null;

  return (
    <div className="app-layout">
      {!user ? (
        <LandingPage onLogin={handleLogin} />
      ) : (
        <Feed userId={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
