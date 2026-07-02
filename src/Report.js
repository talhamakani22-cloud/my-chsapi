import { useEffect, useMemo, useState } from 'react';
import './Report.css';

function Report({ onBackToDashboard, onRequireLogin }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const defaultSelectedMonth = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user && onRequireLogin) {
      onRequireLogin();
    }
  }, [onRequireLogin]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(defaultSelectedMonth);


  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parseVisitorDate = (value) => {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const trimmed = value.trim();
    if (!trimmed) return null;

    // yyyy-mm-dd
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const year = Number(ymd[1]);
      const month = Number(ymd[2]);
      const day = Number(ymd[3]);
      const dt = new Date(year, month - 1, day);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    // dd-mm-yyyy or dd/mm/yyyy
    const dmy = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      const dt = new Date(year, month - 1, day);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatMonthLabel = (monthKey) => {
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return monthKey;
    }

    return new Date(year, month - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const to12HourTime = (value) => {
    if (!value) return '-';

    const already12h = /\b(AM|PM)\b/i.test(value);
    if (already12h) return value.toUpperCase();

    const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (hhmmMatch) {
      let hour = Number(hhmmMatch[1]);
      const minute = hhmmMatch[2];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour}:${minute} ${ampm}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return value;
  };

  const formatEntryTime = (visitor) => {
    if (visitor.entryTime) return to12HourTime(visitor.entryTime);
    if (visitor.checkInTime) {
      return to12HourTime(visitor.checkInTime);
    }
    return '-';
  };

  const formatVisitorStatus = (visitor) => {
    if (visitor.remark) return visitor.remark;
    if (visitor.status === 'checked-in') return 'Checked In';
    if (visitor.status === 'checked-out') return 'Not Checked In';
    return '-';
  };

  const fetchVisitors = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const res = await fetch(`http://localhost:1001/api/visitors?${params.toString()}`);
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

  const getMonthKey = (visitor) => {
    // Group by registration/entry time first so monthly report reflects actual visit month.
    const parsed =
      parseVisitorDate(visitor.createdAt) ||
      parseVisitorDate(visitor.checkInTime) ||
      parseVisitorDate(visitor.entryTime) ||
      parseVisitorDate(visitor.issueDate);
    if (!parsed) return '';
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    return `${parsed.getFullYear()}-${month}`;
  };

  const monthOptions = useMemo(() => {
    return Array.from({ length: currentMonthIndex + 1 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      return `${currentYear}-${month}`;
    }).reverse();
  }, [currentMonthIndex, currentYear]);

  const filteredVisitors = useMemo(() => {
    if (!selectedMonth) return visitors;
    return visitors.filter((visitor) => getMonthKey(visitor) === selectedMonth);
  }, [visitors, selectedMonth]);

  // Fetch all visitors on mount
  useEffect(() => {
    fetchVisitors();
    // eslint-disable-next-line
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    // Prevent search if all fields are empty
    if (!searchQuery.trim() && !startDate.trim() && !endDate.trim() && !selectedMonth.trim()) {
      setError('Please enter at least one filter value.');
      return;
    }
    setError('');
    fetchVisitors();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setSelectedMonth('');
    setError('');
    // Fetch all visitors after clearing filters
    fetchVisitors();
  };

  return (
    <div className="report-container">
      <div className="bg-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
      </div>

      <div className="report-header">
        <div className="report-title">
          <button className="back-btn" onClick={onBackToDashboard}>
            ←
          </button>
          <div>
            <h1>Visitor Report</h1>
            <p className="subtitle">View and filter visitor records</p>
          </div>
        </div>
      </div>

      <div className="report-content">
        {/* Filters Section */}
        <div className="filters-section">
          <div className="filter-row">
            {/* Date Pickers */}
            <div className="date-picker-group">
              <label>From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="date-input"
              />
            </div>
            <div className="date-picker-group">
              <label>To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="date-input"
              />
            </div>

            <div className="month-group">
              <label>Monthly Report</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="month-select"
              >
                <option value="">All Months</option>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                      {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="search-group">
              <label>Search</label>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by identity number, name, father name, house number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <button className="clear-btn" onClick={handleClearFilters}>
              Clear Filters
            </button>
            <button className="search-btn" onClick={handleSearch}>
              🔍 Search
            </button>
            <button className="refresh-btn" onClick={fetchVisitors}>
              🔄 Refresh
            </button>
          </div>

          <div className="results-count">
            {loading ? 'Loading...' : `Showing ${filteredVisitors.length} records`}
            {error && <span style={{ color: 'red', marginLeft: 10 }}>{error}</span>}
          </div>
        </div>

        {/* Visitors Table */}
        <div className="table-wrapper">
          <table className="visitors-report-table">
            <thead>
              <tr>
                <th>Identity Number</th>
                <th>Name</th>
                <th>Father Name</th>
                <th>Country of Stay</th>
                <th>House Number</th>
                <th>Entry Time</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th>Expiry Date</th>
                <th>Issue Date</th>
                <th>Purpose of Visit</th>
                <th>Visitor Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisitors.length > 0 ? (
                filteredVisitors.map((visitor, index) => (
                  <tr key={index}>
                    <td className="emirates-id-cell">{visitor.emiratesId}</td>
                    <td className="name-en-cell">{visitor.fullNameEnglish}</td>
                    <td>{visitor.fatherName || '-'}</td>
                    <td>
                      <span className="nationality-badge">{visitor.countryOfStay || visitor.nationality}</span>
                    </td>
                    <td>{visitor.houseNumber || '-'}</td>
                    <td>{formatEntryTime(visitor)}</td>
                    <td>{visitor.dateOfBirth}</td>
                    <td>
                      <span className={`gender-badge ${visitor.gender?.toLowerCase()}`}>{visitor.gender}</span>
                    </td>
                    <td>{visitor.expiryDate}</td>
                    <td>{visitor.issueDate}</td>
                    <td>{visitor.purposeOfVisit || '-'}</td>
                    <td>{formatVisitorStatus(visitor)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12" className="no-results">
                    No records found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-actions">
        <button className="action-btn export-btn">
          📥 Export to CSV
        </button>
        <button className="action-btn print-btn">
          🖨️ Print Report
        </button>
        <button className="action-btn back-dashboard" onClick={onBackToDashboard}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default Report;
