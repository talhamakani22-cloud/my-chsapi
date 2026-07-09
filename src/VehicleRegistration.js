import { useEffect, useMemo, useState } from 'react';
import './Report.css';
import './VehicleRegistration.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

function VehicleRegistration({ onBackToDashboard, onRequireLogin }) {
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user && onRequireLogin) {
      onRequireLogin();
    }
  }, [onRequireLogin]);

  const fetchVehicleRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const res = await fetch(`${API_BASE_URL}/api/vehicle?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setRecords(Array.isArray(data.records) ? data.records : []);
      } else {
        setError(data.message || 'Failed to fetch vehicle records.');
      }
    } catch (_err) {
      setError('Failed to fetch vehicle records.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVehicleRecords();
    const intervalId = setInterval(() => {
      fetchVehicleRecords();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const parseRecordDate = (record) => {
    const source = record.uploadedAt || record.registrationDate;
    if (!source) return null;
    const parsed = new Date(source);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getMonthKey = (record) => {
    const parsed = parseRecordDate(record);
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

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const searchTarget = [
        record.ownerName,
        record.ownerCnic,
        record.flatNumber,
        record.vehicleType,
        record.vehicleNumber,
      ]
        .join(' ')
        .toLowerCase();

      const searchPass = !searchQuery.trim() || searchTarget.includes(searchQuery.trim().toLowerCase());

      const parsedDate = parseRecordDate(record);
      const monthPass = !selectedMonth || getMonthKey(record) === selectedMonth;

      let startPass = true;
      if (startDate && parsedDate) {
        startPass = parsedDate >= new Date(`${startDate}T00:00:00`);
      } else if (startDate && !parsedDate) {
        startPass = false;
      }

      let endPass = true;
      if (endDate && parsedDate) {
        endPass = parsedDate <= new Date(`${endDate}T23:59:59`);
      } else if (endDate && !parsedDate) {
        endPass = false;
      }

      return searchPass && monthPass && startPass && endPass;
    });
  }, [records, searchQuery, selectedMonth, startDate, endDate]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() && !startDate && !endDate && !selectedMonth) {
      setError('Please enter at least one filter value.');
      return;
    }
    setError('');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedMonth('');
    setError('');
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const rowsHtml = filteredRecords.length
      ? filteredRecords
          .map(
            (record) => `
              <tr>
                <td>${record.ownerName || '-'}</td>
                <td>${record.ownerCnic || '-'}</td>
                <td>${record.flatNumber || '-'}</td>
                <td>${record.vehicleType || '-'}</td>
                <td>${record.vehicleNumber || '-'}</td>
                <td>${record.registrationDate || '-'}</td>
                <td>${record.uploadedAt ? new Date(record.uploadedAt).toLocaleString() : '-'}</td>
              </tr>
            `
          )
          .join('')
      : '<tr><td colspan="7" style="text-align:center; padding:16px;">No records found</td></tr>';

    const printedAt = new Date().toLocaleString();

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Vehicle Registration Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin: 0 0 8px 0; font-size: 22px; }
            .meta { margin-bottom: 16px; font-size: 13px; color: #444; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f2f7fb; }
          </style>
        </head>
        <body>
          <h1>Vehicle Registration Report</h1>
          <div class="meta">Printed: ${printedAt}</div>
          <div class="meta">Records: ${filteredRecords.length}</div>
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Owner CNIC</th>
                <th>Flat</th>
                <th>Vehicle Type</th>
                <th>Vehicle Number</th>
                <th>Registration Date</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
          <button className="back-btn" onClick={onBackToDashboard}>←</button>
          <div>
            <h1>Vehicle Registration</h1>
            <p className="subtitle">View and filter vehicle registration records</p>
          </div>
        </div>
      </div>

      <div className="report-content">
        <div className="filters-section">
          <form className="filter-row" onSubmit={handleSearch}>
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

            <div className="search-group">
              <label>Search</label>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by owner, CNIC, flat, vehicle number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <button className="clear-btn" type="button" onClick={handleClearFilters}>
              Clear Filters
            </button>
            <button className="search-btn" type="submit">🔍 Search</button>
            <button className="refresh-btn" type="button" onClick={fetchVehicleRecords}>🔄 Refresh</button>
          </form>

          <div className="results-count">
            {loading ? 'Loading...' : `Showing ${filteredRecords.length} records`}
            {error && <span style={{ color: 'red', marginLeft: 10 }}>{error}</span>}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="visitors-report-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Owner CNIC</th>
                <th>Flat</th>
                <th>Vehicle Type</th>
                <th>Vehicle Number</th>
                <th>Registration Date</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={String(record._id || `${record.vehicleNumber}-${record.uploadedAt}`)}>
                    <td className="name-en-cell">{record.ownerName || '-'}</td>
                    <td className="emirates-id-cell">{record.ownerCnic || '-'}</td>
                    <td>{record.flatNumber || '-'}</td>
                    <td><span className="nationality-badge">{record.vehicleType || '-'}</span></td>
                    <td><strong>{record.vehicleNumber || '-'}</strong></td>
                    <td>{record.registrationDate || '-'}</td>
                    <td>{record.uploadedAt ? new Date(record.uploadedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-results">No vehicle records found matching your criteria</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-actions">
        <button className="action-btn print-btn" onClick={handlePrintReport}>
          🖨️ Print Report
        </button>
        <button className="action-btn back-dashboard" onClick={onBackToDashboard}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default VehicleRegistration;
