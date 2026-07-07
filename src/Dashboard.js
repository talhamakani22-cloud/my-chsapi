import { useEffect, useState } from 'react';
import './Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

function Dashboard({ onNavigateToReport, onNavigateToFamilyDetails, onNavigateToVehicleRegistration, onNavigateToERecipets, sessionUser, onLogout }) {
  const loginType = String(sessionUser?.loginType || '').toLowerCase();
  const isReception = loginType === 'reception';
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVisitors = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/api/visitors`);
        const data = await res.json();
        if (data.success) {
          setVisitors(data.visitors);
        } else {
          setError(data.message || 'Failed to fetch visitors');
        }
      } catch (err) {
        setError('Failed to fetch visitors');
      }
      setLoading(false);
    };

    fetchVisitors();

    const intervalId = setInterval(() => {
      fetchVisitors();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Compute stats
  const totalRecords = visitors.length;
  const maleCount = visitors.filter(v => v.gender === 'Male').length;
  const femaleCount = visitors.filter(v => v.gender === 'Female').length;
  const activeIds = visitors.length; // Assuming all are active
  // Expiring soon: expiryDate within next 30 days
  const expiringSoon = visitors.filter(v => {
    if (!v.expiryDate) return false;
    const expiry = new Date(v.expiryDate);
    const now = new Date();
    const diff = (expiry - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  // Visitor types
  const uaeCitizens = visitors.filter(v => v.nationality === 'UAE').length;
  const residents = visitors.filter(v => v.nationality !== 'UAE').length;
  const visitorTypes = [
    { type: 'UAE Citizens', count: uaeCitizens, color: '#58aee6' },
    { type: 'Residents', count: residents, color: '#9fd7f5' },
    { type: 'Active IDs', count: activeIds, color: '#38bdf8' },
    { type: 'Expiring Soon', count: expiringSoon, color: '#34d399' },
  ];
  const totalVisitorTypes = visitorTypes.reduce((sum, v) => sum + v.count, 0);

  // Recent visitors (last 5 by recently added first)
  const recentVisitors = [...visitors]
    .sort((a, b) => {
      const aDate = new Date(a.createdAt || a.checkInTime || a.issueDate || 0);
      const bDate = new Date(b.createdAt || b.checkInTime || b.issueDate || 0);
      return bDate - aDate;
    })
    .slice(0, 5);

  // Monthly registrations for the last 6 months based on created/check-in/issue date.
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${dt.getFullYear()}-${dt.getMonth()}`,
      label: monthLabels[dt.getMonth()],
      visitors: 0,
      year: dt.getFullYear(),
      month: dt.getMonth(),
    };
  });

  visitors.forEach((v) => {
    const source = v.createdAt || v.checkInTime || v.issueDate;
    if (!source) return;
    const d = new Date(source);
    if (Number.isNaN(d.getTime())) return;
    const idx = monthlyData.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx !== -1) monthlyData[idx].visitors += 1;
  });

  const maxVisitors = Math.max(...monthlyData.map((d) => d.visitors), 1);

  return (
    <div className="dashboard-container">
      <div className="bg-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
      </div>

      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>Pakistan ID Dashboard 🇵🇰</h1>
          <p className="subtitle">Monitor and manage Pakistan ID records</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Records</span>
            <span className="stat-number">{totalRecords}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Male</span>
            <span className="stat-number">{maleCount}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Female</span>
            <span className="stat-number">{femaleCount}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Active IDs</span>
            <span className="stat-number highlight">{activeIds}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Charts Row */}
        <div className="charts-row">
          {/* Monthly Registrations Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Monthly Registrations</h3>
            <div className="bar-chart">
              {monthlyData.map((item, index) => (
                <div className="bar-item" key={index}>
                  <div className="bar-container">
                    <div 
                      className="bar" 
                      style={{ height: `${(item.visitors / maxVisitors) * 100}%` }}
                    >
                      <span className="bar-value">{item.visitors}</span>
                    </div>
                  </div>
                  <span className="bar-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ID Types Chart */}
          <div className="chart-card">
            <h3 className="chart-title">ID Statistics</h3>
            <div className="donut-chart-container">
              <div className="donut-chart">
                <svg viewBox="0 0 100 100">
                  {visitorTypes.reduce((acc, item, index) => {
                    const percentage = (item.count / totalVisitorTypes) * 100;
                    const previousPercentages = visitorTypes
                      .slice(0, index)
                      .reduce((sum, v) => sum + (v.count / totalVisitorTypes) * 100, 0);
                    const strokeDasharray = `${percentage} ${100 - percentage}`;
                    const strokeDashoffset = -previousPercentages;
                    
                    acc.push(
                      <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="12"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: 'all 0.3s ease' }}
                      />
                    );
                    return acc;
                  }, [])}
                </svg>
                <div className="donut-center">
                  <span className="donut-total">{totalVisitorTypes}</span>
                  <span className="donut-label">Total</span>
                </div>
              </div>
              <div className="legend">
                {visitorTypes.map((item, index) => (
                  <div className="legend-item" key={index}>
                    <span className="legend-color" style={{ background: item.color }}></span>
                    <span className="legend-text">{item.type}</span>
                    <span className="legend-count">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Records Table */}
        <div className="recent-visitors-card">
          <h3 className="chart-title">Recent Pakistan ID Records</h3>
          <div className="visitors-table">
            <div className="table-header">
              <span>Emirates ID</span>
              <span>Full Name (English)</span>
              <span>Gender</span>
              <span>Expiry Date</span>
            </div>
            {recentVisitors.map((visitor, index) => (
              <div className="table-row" key={index}>
                <span className="visitor-name emirates-id">{visitor.emiratesId}</span>
                <span className="visitor-type">{visitor.fullNameEnglish || visitor.nameEn}</span>
                <span className={`visitor-status ${visitor.gender?.toLowerCase()}`}>
                  {visitor.gender}
                </span>
                <span className="visitor-time">{visitor.expiryDate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-actions">
        {!isReception && (
          <button
            className="action-btn primary"
            onClick={onNavigateToFamilyDetails}
          >
            Family Details
          </button>
        )}
        {!isReception && (
          <button
            className="action-btn primary"
            onClick={onNavigateToVehicleRegistration}
          >
            Vehicle Registration
          </button>
        )}
        {!isReception && (
          <button className="action-btn primary" onClick={onNavigateToERecipets}>
            E Recipets
          </button>
        )}
        <button className="action-btn primary" onClick={onNavigateToReport}>
          View Reports
        </button>
        {loading && <div style={{marginTop: 10}}>Loading...</div>}
        {error && <div style={{color: 'red', marginTop: 10}}>{error}</div>}
      </div>
    </div>
  );
}

export default Dashboard;

