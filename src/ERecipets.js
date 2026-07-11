import { useEffect, useMemo, useState } from 'react';
import './Report.css';
import './ERecipets.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

const buildFileUrl = (value) => {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
};

function ERecipets({ onBackToDashboard, onRequireLogin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [scope, setScope] = useState('resident');
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({
    ownerName: '',
    residentName: '',
    flatNumber: '',
    receiptMonth: '',
    amount: '',
    status: '',
    paymentDate: '',
    note: '',
  });
  const [savingAction, setSavingAction] = useState(false);

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
      const res = await fetch(`${API_BASE_URL}/api/maintenance/report`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch e-recipets.');
      }
      setScope(data.scope || 'resident');
      const normalizedRows = (Array.isArray(data.rows) ? data.rows : []).map((row) => {
        const amount = Number(row.amount || 0);
        const status = String(row.status || '').toLowerCase();
        const isPaid = status === 'paid';
        const isActive = row.isActive !== false && status !== 'inactive';

        return {
          ...row,
          amount,
          isActive,
          receivedAmount: isPaid ? amount : 0,
          pendingAmount: isPaid ? 0 : amount,
        };
      });
      setRows(normalizedRows);
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

  const startEditRow = (row) => {
    setEditingId(String(row.id || ''));
    setEditForm({
      ownerName: row.ownerName || '',
      residentName: row.residentName || '',
      flatNumber: row.flatNumber || '',
      receiptMonth: row.receiptMonth || '',
      amount: String(row.amount ?? ''),
      status: row.status || '',
      paymentDate: row.paymentDate === '-' ? '' : (row.paymentDate || ''),
      note: row.note === '-' ? '' : (row.note || ''),
    });
  };

  const cancelEditRow = () => {
    setEditingId('');
    setEditForm({
      ownerName: '',
      residentName: '',
      flatNumber: '',
      receiptMonth: '',
      amount: '',
      status: '',
      paymentDate: '',
      note: '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || savingAction) return;

    const amount = Number(editForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    try {
      setSavingAction(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/maintenance/${editingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerName: editForm.ownerName,
          residentName: editForm.residentName,
          flatNumber: editForm.flatNumber,
          receiptMonth: editForm.receiptMonth,
          amount,
          status: editForm.status,
          paymentDate: editForm.paymentDate,
          note: editForm.note,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update receipt.');
      }

      cancelEditRow();
      fetchReceipts();
    } catch (err) {
      setError(err.message || 'Failed to update receipt.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteRow = async (row) => {
    const receiptId = String(row.id || '');
    if (!receiptId || savingAction) return;

    const confirmed = window.confirm(`Mark receipt ${row.receiptNo || ''} as inactive?`);
    if (!confirmed) return;

    try {
      setSavingAction(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/maintenance/${receiptId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !(row.isActive !== false && String(row.status || '').toLowerCase() !== 'inactive'),
          status: row.status || 'Unpaid',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update receipt status.');
      }

      if (editingId === receiptId) {
        cancelEditRow();
      }
      fetchReceipts();
    } catch (err) {
      setError(err.message || 'Failed to update receipt status.');
    } finally {
      setSavingAction(false);
    }
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const statusFilteredRows = rows.filter((row) => {
      const active = row.isActive !== false && String(row.status || '').toLowerCase() !== 'inactive';
      if (statusFilter === 'active') return active;
      if (statusFilter === 'inactive') return !active;
      return true;
    });

    if (!query) return statusFilteredRows;

    return statusFilteredRows.filter((row) =>
      [
        row.receiptNo,
        row.ownerName,
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
  }, [rows, searchQuery, statusFilter]);

  const perFlatAmount = useMemo(() => {
    if (!filteredRows.length) return 0;

    const amounts = Array.from(
      new Set(filteredRows.map((row) => Number(row.amount || 0).toFixed(2)))
    );

    if (amounts.length === 1) {
      return Number(amounts[0]);
    }

    return null;
  }, [filteredRows]);

  const totalPendingForMembers = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number(row.pendingAmount || 0), 0);
  }, [filteredRows]);

  const totalReceivedForMembers = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number(row.receivedAmount || 0), 0);
  }, [filteredRows]);

  const canManageRows = scope === 'all';

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const rowsHtml = filteredRows.length
      ? filteredRows
          .map(
            (row) => `
              <tr>
                <td>${row.receiptNo || '-'}</td>
                <td>${row.ownerName || '-'}</td>
                <td>${row.residentName || '-'}</td>
                <td>${row.flatNumber || '-'}</td>
                <td>${row.receiptMonth || '-'}</td>
                <td>PKR ${Number(row.amount || 0).toFixed(2)}</td>
                <td>${row.status || '-'}</td>
                <td>${row.paymentDate || '-'}</td>
                <td>${row.note || '-'}</td>
                <td>${buildFileUrl(row.paymentSlipPath || row.paymentSlipUrl) ? 'Available' : '-'}</td>
                <td>PKR ${Number(row.receivedAmount || 0).toFixed(2)}</td>
                <td>PKR ${Number(row.pendingAmount || 0).toFixed(2)}</td>
              </tr>
            `
          )
          .join('')
      : '<tr><td colspan="12" style="text-align:center; padding:16px;">No records found</td></tr>';

    const printedAt = new Date().toLocaleString();

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>E Recipets Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin: 0 0 8px 0; font-size: 22px; }
            .meta { margin-bottom: 16px; font-size: 13px; color: #444; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f2f7fb; }
          </style>
        </head>
        <body>
          <h1>E Recipets Report</h1>
          <div class="meta">Printed: ${printedAt}</div>
          <div class="meta">Records: ${filteredRows.length}</div>
          <table>
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Owner Name</th>
                <th>Resident Name</th>
                <th>Flat Number</th>
                <th>Receipt Month</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Note</th>
                <th>Slip Proof</th>
                <th>Received Amount</th>
                <th>Pending Amount</th>
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
            <div className="erecipets-status-filter">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="erecipets-status-select"
              >
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="all">All</option>
              </select>
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
            <span className="label">Per Flat Amount</span>
            <strong>{perFlatAmount === null ? 'Mixed' : `PKR ${perFlatAmount.toFixed(2)}`}</strong>
          </div>
          <div className="erecipets-summary-card">
            <span className="label">Received Amount</span>
            <strong>PKR {totalReceivedForMembers.toFixed(2)}</strong>
          </div>
          <div className="erecipets-summary-card">
            <span className="label">Pending Amount</span>
            <strong>PKR {totalPendingForMembers.toFixed(2)}</strong>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="visitors-report-table erecipets-table">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Owner Name</th>
                <th>Resident Name</th>
                <th>Flat Number</th>
                <th>Receipt Month</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Note</th>
                <th>Slip Proof</th>
                <th>Received Amount</th>
                <th>Pending Amount</th>
                {canManageRows && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                <>
                  {filteredRows.map((row) => (
                    <tr key={String(row.id || row.receiptNo)}>
                      <td className="emirates-id-cell">{row.receiptNo || '-'}</td>
                      <td className="name-en-cell">
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.ownerName} onChange={(e) => setEditForm((prev) => ({ ...prev, ownerName: e.target.value }))} />
                        ) : (
                          row.ownerName || '-'
                        )}
                      </td>
                      <td className="name-en-cell">
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.residentName} onChange={(e) => setEditForm((prev) => ({ ...prev, residentName: e.target.value }))} />
                        ) : (
                          row.residentName || '-'
                        )}
                      </td>
                      <td>
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.flatNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, flatNumber: e.target.value }))} />
                        ) : (
                          row.flatNumber || '-'
                        )}
                      </td>
                      <td>
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.receiptMonth} onChange={(e) => setEditForm((prev) => ({ ...prev, receiptMonth: e.target.value }))} />
                        ) : (
                          row.receiptMonth || '-'
                        )}
                      </td>
                      <td>
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.amount} onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))} />
                        ) : (
                          `PKR ${Number(row.amount || 0).toFixed(2)}`
                        )}
                      </td>
                      <td>
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.status} onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))} />
                        ) : (
                          <span className={`erecipet-status ${String(row.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                            {row.status || '-'}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.paymentDate} onChange={(e) => setEditForm((prev) => ({ ...prev, paymentDate: e.target.value }))} />
                        ) : (
                          row.paymentDate || '-'
                        )}
                      </td>
                      <td>
                        {editingId === String(row.id || '') ? (
                          <input className="erecipets-inline-input" value={editForm.note} onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))} />
                        ) : (
                          row.note || '-'
                        )}
                      </td>
                      <td>
                        {buildFileUrl(row.paymentSlipPath || row.paymentSlipUrl) ? (
                          <a
                            className="erecipets-slip-link"
                            href={buildFileUrl(row.paymentSlipPath || row.paymentSlipUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.paymentSlipName ? 'View Slip' : 'Open Proof'}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>PKR {Number(row.receivedAmount || 0).toFixed(2)}</td>
                      <td>PKR {Number(row.pendingAmount || 0).toFixed(2)}</td>
                      {canManageRows && (
                        <td>
                          {editingId === String(row.id || '') ? (
                            <div className="erecipets-action-group">
                              <button className="erecipets-action-btn save" onClick={handleSaveEdit} disabled={savingAction}>Save</button>
                              <button className="erecipets-action-btn cancel" onClick={cancelEditRow} disabled={savingAction}>Cancel</button>
                            </div>
                          ) : (
                            <div className="erecipets-action-group">
                              <button className="erecipets-action-btn edit" onClick={() => startEditRow(row)} disabled={savingAction}>Edit</button>
                              <button className="erecipets-action-btn delete" onClick={() => handleDeleteRow(row)} disabled={savingAction}>{row.isActive !== false && String(row.status || '').toLowerCase() !== 'inactive' ? 'Deactivate' : 'Activate'}</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="erecipets-total-row">
                    <td colSpan={canManageRows ? '10' : '10'} className="erecipets-total-label">Totals (All Members)</td>
                    <td className="erecipets-total-value">PKR {totalReceivedForMembers.toFixed(2)}</td>
                    <td className="erecipets-total-value">PKR {totalPendingForMembers.toFixed(2)}</td>
                    {canManageRows && <td />}
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={canManageRows ? '13' : '12'} className="no-results">
                    No e-recipets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-actions">
        <button className="action-btn export-btn" onClick={handlePrintReport}>💾 Save PDF</button>
        <button className="action-btn print-btn" onClick={handlePrintReport}>🖨️ Print Report</button>
        <button className="action-btn back-dashboard" onClick={onBackToDashboard}>Back to Dashboard</button>
      </div>
    </div>
  );
}

export default ERecipets;
