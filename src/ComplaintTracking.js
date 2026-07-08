import { useCallback, useEffect, useState } from 'react';
import './ComplaintTracking.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

const normalizeStatus = (value = '') => String(value).trim().toLowerCase();

const statusProgress = (status = '') => {
  const normalized = normalizeStatus(status);
  if (normalized === 'open') return 25;
  if (normalized === 'in progress') return 60;
  if (normalized === 'resolved') return 85;
  if (normalized === 'closed') return 100;
  return 10;
};

const statusBadgeClass = (status = '') => {
  const normalized = normalizeStatus(status).replace(/\s+/g, '-');
  return `complaint-status-badge ${normalized || 'unknown'}`;
};

function ComplaintTracking({ onBackToDashboard, onRequireLogin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState('');
  const [editStatus, setEditStatus] = useState('Open');
  const [editStatusNote, setEditStatusNote] = useState('');
  const [savingStatusId, setSavingStatusId] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user && onRequireLogin) {
      onRequireLogin();
    }
  }, [onRequireLogin]);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      params.set('limit', '500');

      const query = params.toString();
      const url = query ? `${API_BASE_URL}/api/complaints?${query}` : `${API_BASE_URL}/api/complaints`;

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch complaints.');
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setCanManage(Boolean(data.canManage));
    } catch (err) {
      setRows([]);
      setCanManage(false);
      setError(err.message || 'Failed to fetch complaints.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  const startEdit = (row) => {
    setEditingId(String(row._id || row.id || ''));
    setEditStatus(String(row.status || 'Open'));
    setEditStatusNote(String(row.statusNote || ''));
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditStatus('Open');
    setEditStatusNote('');
  };

  const saveStatus = async (complaintId) => {
    if (!complaintId || !canManage) return;

    try {
      setSavingStatusId(complaintId);
      setError('');

      const res = await fetch(`${API_BASE_URL}/api/complaints/${complaintId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: editStatus, statusNote: editStatusNote }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update complaint status.');
      }

      cancelEdit();
      fetchComplaints();
    } catch (err) {
      setError(err.message || 'Failed to update complaint status.');
    } finally {
      setSavingStatusId('');
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchComplaints();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchComplaints]);

  useEffect(() => {
    const intervalId = setInterval(fetchComplaints, 10000);
    return () => clearInterval(intervalId);
  }, [fetchComplaints]);

  return (
    <div className="complaint-tracking-page">
      <div className="complaint-tracking-header">
        <div>
          <h1>Complaint Tracking</h1>
          <p>Reception desk can follow up every ticket status in real time.</p>
        </div>
        <button className="complaint-back-btn" onClick={onBackToDashboard}>Back to Dashboard</button>
      </div>

      <div className="complaint-tracking-controls">
        <input
          className="complaint-search"
          placeholder="Search by ticket no, flat, type, description, status"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="complaint-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <button className="complaint-refresh-btn" onClick={fetchComplaints}>Refresh</button>
      </div>

      {loading ? <div className="complaint-state-msg">Loading complaints...</div> : null}
      {error ? <div className="complaint-state-error">{error}</div> : null}

      <div className="complaint-tracking-list">
        {rows.length === 0 ? (
          <div className="complaint-state-msg">No complaints found for selected filters.</div>
        ) : (
          rows.map((row) => {
            const complaintId = String(row._id || row.id || '');
            const isEditing = canManage && editingId === complaintId;
            const progress = statusProgress(row.status);
            return (
              <div className="complaint-card" key={String(row._id || row.id || row.ticketNo || Math.random())}>
                <div className="complaint-card-head">
                  <div className="complaint-card-title">{row.ticketNo || 'Ticket'}</div>
                  <span className={statusBadgeClass(row.status)}>{row.status || 'Unknown'}</span>
                </div>

                <div className="complaint-card-meta">
                  <span>Flat: {row.flatNumber || '-'}</span>
                  <span>Type: {row.complaintType || 'General'}</span>
                  <span>By: {row.sender?.email || '-'}</span>
                </div>

                <p className="complaint-description">{row.description || '-'}</p>

                <div className="complaint-progress-track">
                  <div className="complaint-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="complaint-progress-label">Progress: {progress}%</div>

                <div className="complaint-status-note">
                  <strong>Follow-up Note:</strong> {row.statusNote || 'No note added yet.'}
                </div>

                {canManage ? (
                  <div className="complaint-manage-box">
                    {isEditing ? (
                      <>
                        <select
                          className="complaint-inline-input"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <input
                          className="complaint-inline-input"
                          value={editStatusNote}
                          onChange={(e) => setEditStatusNote(e.target.value)}
                          placeholder="Add follow-up note"
                        />
                        <div className="complaint-manage-actions">
                          <button
                            className="complaint-save-btn"
                            onClick={() => saveStatus(complaintId)}
                            disabled={savingStatusId === complaintId}
                          >
                            {savingStatusId === complaintId ? 'Saving...' : 'Save'}
                          </button>
                          <button className="complaint-cancel-btn" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <button className="complaint-edit-btn" onClick={() => startEdit(row)}>
                        Edit Status
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ComplaintTracking;
