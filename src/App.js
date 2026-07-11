import React, { useCallback, useEffect, useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Report from './Report';
import FamilyDetails from './FamilyDetails';
import VehicleRegistration from './VehicleRegistration';
import ERecipets from './ERecipets';
import ComplaintTracking from './ComplaintTracking';
import Documents from './Documents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

function App() {
  const [screen, setScreen] = useState('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  const normalizedLoginType = String(sessionUser?.loginType || '').toLowerCase().trim().replace(/[-_\s]+/g, '');
  const isReceptionLogin = normalizedLoginType === 'reception' || normalizedLoginType === 'receptiondesk';

  const canAccessScreen = useCallback((targetScreen) => {
    if (!isReceptionLogin) return true;
    return targetScreen === 'dashboard' || targetScreen === 'report' || targetScreen === 'family-details' || targetScreen === 'complaint-tracking';
  }, [isReceptionLogin]);

  const renderDashboard = () => (
    <Dashboard
      onNavigateToReport={() => setScreen('report')}
      onNavigateToFamilyDetails={() => canAccessScreen('family-details') && setScreen('family-details')}
      onNavigateToVehicleRegistration={() => canAccessScreen('vehicle-registration') && setScreen('vehicle-registration')}
      onNavigateToERecipets={() => canAccessScreen('e-recipets') && setScreen('e-recipets')}
      onNavigateToDocuments={() => canAccessScreen('documents') && setScreen('documents')}
      onNavigateToComplaintTracking={() => canAccessScreen('complaint-tracking') && setScreen('complaint-tracking')}
      sessionUser={sessionUser}
      onLogout={handleLogout}
    />
  );

  // Check session from backend only on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' });
        let data = {};
        try {
          data = await res.json();
        } catch {
          setIsLoggedIn(false);
          setScreen('login');
          return;
        }
        setIsLoggedIn(data.loggedIn);
        setSessionUser(data.loggedIn ? data.user || null : null);
        if (data.loggedIn && screen === 'login') {
          setScreen('dashboard');
        }
        if (!data.loggedIn && screen !== 'login') {
          setScreen('login');
        }
      } catch {
        setIsLoggedIn(false);
        setSessionUser(null);
        setScreen('login');
      }
    };
    checkSession();
    // eslint-disable-next-line
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('user');
    await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST', credentials: 'include' });
    setIsLoggedIn(false);
    setSessionUser(null);
    setScreen('login');
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!canAccessScreen(screen)) {
      setScreen('dashboard');
    }
  }, [isLoggedIn, screen, canAccessScreen]);

  if (!isLoggedIn) {
    return <Login onSignInSuccess={async () => {
      // Check session after login
      const res = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' });
      let data = {};
      try {
        data = await res.json();
      } catch {
        setIsLoggedIn(false);
        setScreen('login');
        return;
      }
      setIsLoggedIn(data.loggedIn);
      setSessionUser(data.loggedIn ? data.user || null : null);
      setScreen('dashboard');
    }} />;
  }

  if (screen === 'dashboard') {
    return renderDashboard();
  }

  if (screen === 'report') {
    return <Report onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'family-details') {
    if (!canAccessScreen('family-details')) {
      return renderDashboard();
    }
    return <FamilyDetails onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'vehicle-registration') {
    if (!canAccessScreen('vehicle-registration')) {
      return renderDashboard();
    }
    return <VehicleRegistration onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'e-recipets') {
    if (!canAccessScreen('e-recipets')) {
      return renderDashboard();
    }
    return <ERecipets onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'documents') {
    if (!canAccessScreen('documents')) {
      return renderDashboard();
    }
    return <Documents onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'complaint-tracking') {
    if (!canAccessScreen('complaint-tracking')) {
      return renderDashboard();
    }
    return <ComplaintTracking onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  return <Login onSignInSuccess={async () => {
    const res = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' });
    let data = {};
    try {
      data = await res.json();
    } catch {
      setIsLoggedIn(false);
      setScreen('login');
      return;
    }
    setIsLoggedIn(data.loggedIn);
    setSessionUser(data.loggedIn ? data.user || null : null);
    setScreen('dashboard');
  }} />;
}

export default App;
