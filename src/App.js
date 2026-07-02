import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Report from './Report';

function App() {
  const [screen, setScreen] = useState('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check session from backend only on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        let data = {};
        try {
          data = await res.json();
        } catch {
          setIsLoggedIn(false);
          setScreen('login');
          return;
        }
        setIsLoggedIn(data.loggedIn);
        if (data.loggedIn && screen === 'login') {
          setScreen('dashboard');
        }
        if (!data.loggedIn && screen !== 'login') {
          setScreen('login');
        }
      } catch {
        setIsLoggedIn(false);
        setScreen('login');
      }
    };
    checkSession();
    // eslint-disable-next-line
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('user');
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setIsLoggedIn(false);
    setScreen('login');
  };

  if (!isLoggedIn) {
    return <Login onSignInSuccess={async () => {
      // Check session after login
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      let data = {};
      try {
        data = await res.json();
      } catch {
        setIsLoggedIn(false);
        setScreen('login');
        return;
      }
      setIsLoggedIn(data.loggedIn);
      setScreen('dashboard');
    }} />;
  }

  if (screen === 'dashboard') {
    return (
      <Dashboard
        onNavigateToReport={() => setScreen('report')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'report') {
    return <Report onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  return <Login onSignInSuccess={async () => {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    let data = {};
    try {
      data = await res.json();
    } catch {
      setIsLoggedIn(false);
      setScreen('login');
      return;
    }
    setIsLoggedIn(data.loggedIn);
    setScreen('dashboard');
  }} />;
}

export default App;
