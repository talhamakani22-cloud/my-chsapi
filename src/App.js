import React, { useEffect, useState } from 'react';
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

  const renderDashboard = () => (
    <Dashboard
      onNavigateToReport={() => setScreen('report')}
      onNavigateToFamilyDetails={() => setScreen('family-details')}
      onNavigateToVehicleRegistration={() => setScreen('vehicle-registration')}
      onNavigateToERecipets={() => setScreen('e-recipets')}
      onNavigateToDocuments={() => setScreen('documents')}
      onNavigateToComplaintTracking={() => setScreen('complaint-tracking')}
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
    if (!screen) {
      setScreen('dashboard');
    }
  }, [isLoggedIn, screen]);

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
    return <FamilyDetails onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'vehicle-registration') {
    return <VehicleRegistration onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'e-recipets') {
    return <ERecipets onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'documents') {
    return <Documents onBackToDashboard={() => setScreen('dashboard')} onRequireLogin={handleLogout} />;
  }

  if (screen === 'complaint-tracking') {
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
