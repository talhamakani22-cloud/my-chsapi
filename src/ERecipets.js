import { useEffect, useMemo, useState } from 'react';
import './Report.css';
import './ERecipets.css';

function ERecipets({ onBackToDashboard, onRequireLogin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user && onRequireLogin) {
      onRequireLogin();
    }
  }, [onRequireLogin]);

  const fetchReceipts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/maintenance/report', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch e-recipets.');
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      setRows([]);
      setError(err.message || 'Failed to fetch e-recipets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
    const intervalId = setInterval(fetchReceipts, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [
        row.receiptNo,
        row.residentName,
        row.flatNumber,
        row.receiptMonth,
        row.status,
        row.note,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [rows, searchQuery]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.amount += Number(row.amount || 0);
        acc.received += Number(row.receivedAmount || 0);
        acc.pending += Number(row.pendingAmount || 0);
        return acc;
      },
      { amount: 0, received: 0, pending: 0 }
    );
  }, [filteredRows]);

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
            <h1>E Recipets</h1>
            <p className="subtitle">Maintenance e-recipets with amount details</p>
          </div>
        </div>
      </div>

      <div className="report-content">
        <div className="filters-section">
          <div className="filter-row">
            <div className="search-group erecipets-search">
              <label>Search</label>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by receipt no, resident, flat, month, status"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <button className="refresh-btn" onClick={fetchReceipts}>🔄 Refresh</button>
          </div>
          <div className="results-count">
            {loading ? 'Loading...' : `Showing ${filteredRows.length} records`}
            {error && <span style={{ color: 'red', marginLeft: 10 }}>{error}</span>}
          </div>
        </div>

        <div className="erecipets-summary-row">
          <div className="erecipets-summary-card">
            <span className="label">Total Amount</span>
            <strong>PKR {totals.amount.toFixed(2)}</strong>
          </div>
          <div className="erecipets-summary-card">
            <span className="label">Received Amount</span>
            <strong>PKR {totals.received.toFixed(2)}</strong>
          </div>
          <div className="erecipets-summary-card">
            <span className="label">Pending Amount</span>
            <strong>PKR {totals.pending.toFixed(2)}</strong>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="visitors-report-table erecipets-table">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Resident Name</th>
                <th>Flat Number</th>
                <th>Receipt Month</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Note</th>
                <th>Received Amount</th>
                <th>Pending Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={String(row.id || row.receiptNo)}>
                    <td className="emirates-id-cell">{row.receiptNo || '-'}</td>
                    <td className="name-en-cell">{row.residentName || '-'}</td>
                    <td>{row.flatNumber || '-'}</td>
                    <td>{row.receiptMonth || '-'}</td>
                    <td>PKR {Number(row.amount || 0).toFixed(2)}</td>
                    <td>
                      <span className={`erecipet-status ${String(row.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                        {row.status || '-'}
                      </span>
                    </td>
                    <td>{row.paymentDate || '-'}</td>
                    <td>{row.note || '-'}</td>
                    <td>PKR {Number(row.receivedAmount || 0).toFixed(2)}</td>
                    <td>PKR {Number(row.pendingAmount || 0).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="no-results">
                    No e-recipets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ERecipets;
