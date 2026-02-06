import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Feed from './pages/Feed';
import AuditLog from './components/AuditLog';
import ReputationViewer from './components/ReputationViewer';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'audit', 'reputation'

  useEffect(() => {
    // Check local storage for existing session
    const storedUser = localStorage.getItem('acr_user_id');
    if (storedUser) {
      setUser(storedUser);
    }
    
    // Check URL for direct navigation
    const path = window.location.pathname;
    if (path.includes('audit-log')) {
      setCurrentView('audit');
    } else if (path.includes('reputation')) {
      setCurrentView('reputation');
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
    setCurrentView('main');
  };

  if (loading) return null;

  // Public routes (no auth required)
  if (currentView === 'audit') {
    return (
      <div className="app-layout">
        <div className="public-nav">
          <button onClick={() => setCurrentView('main')} className="nav-back-btn">
            ← Back to Main
          </button>
        </div>
        <AuditLog />
      </div>
    );
  }

  if (currentView === 'reputation') {
    return (
      <div className="app-layout">
        <div className="public-nav">
          <button onClick={() => setCurrentView('main')} className="nav-back-btn">
            ← Back to Main
          </button>
        </div>
        <ReputationViewer />
      </div>
    );
  }

  // Main app
  return (
    <div className="app-layout">
      {!user ? (
        <LandingPage onLogin={handleLogin} />
      ) : (
        <Feed 
          userId={user} 
          onLogout={handleLogout} 
          onNavigate={setCurrentView}
        />
      )}
    </div>
  );
}

export default App;
