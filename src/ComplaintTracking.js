import { useCallback, useEffect, useState } from 'react';
import './Report.css';
import './ComplaintTracking.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

const normalizeStatus = (value = '') => String(value).trim().toLowerCase();

const statusProgress = (status = '') => {
  const normalized = normalizeStatus(status);
  if (normalized === 'registered') return 15;
  if (normalized === 'under review') return 35;
  if (normalized === 'assigned') return 50;
  if (normalized === 'in progress') return 70;
  if (normalized === 'resolved') return 90;
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
  const [editStatus, setEditStatus] = useState('Registered');
  const [editStatusNote, setEditStatusNote] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [savingStatusId, setSavingStatusId] = useState('');
  const [expandedId, setExpandedId] = useState('');

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
    setEditStatus(String(row.status || 'Registered'));
    setEditStatusNote(String(row.statusNote || ''));
    setEditAssignedTo(String(row.assignedTo || ''));
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditStatus('Registered');
    setEditStatusNote('');
    setEditAssignedTo('');
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
        body: JSON.stringify({ status: editStatus, statusNote: editStatusNote, assignedTo: editAssignedTo }),
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

  const buildMediaUrl = (mediaUri) => {
    const source = String(mediaUri || '').trim();
    if (!source) return '';
    if (/^https?:\/\//i.test(source)) return source;
    if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
    return `${API_BASE_URL}/${source}`;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString();
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const rowsHtml = rows.length
      ? rows
          .map((row) => {
            const progress = statusProgress(row.status);
            return `
              <tr>
                <td>${row.ticketNo || '-'}</td>
                <td>${row.flatNumber || '-'}</td>
                <td>${row.complaintType || 'General'}</td>
                <td>${row.status || '-'}</td>
                <td>${progress}%</td>
                <td>${row.statusNote || 'No note added yet.'}</td>
                <td>${row.sender?.email || '-'}</td>
                <td>${formatDateTime(row.createdAt)}</td>
                <td>${formatDateTime(row.updatedAt)}</td>
              </tr>
            `;
          })
          .join('')
      : '<tr><td colspan="9" style="text-align:center; padding:16px;">No complaints found</td></tr>';

    const printedAt = new Date().toLocaleString();

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Complaint Tracking Report</title>
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
          <h1>Complaint Tracking Report</h1>
          <div class="meta">Printed: ${printedAt}</div>
          <div class="meta">Records: ${rows.length} | Status Filter: ${statusFilter} | Search: ${searchQuery || 'None'}</div>
          <table>
            <thead>
              <tr>
                <th>Ticket No</th>
                <th>Flat Number</th>
                <th>Complaint Type</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Follow-up Note</th>
                <th>Raised By</th>
                <th>Created</th>
                <th>Updated</th>
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
            <h1>Complaint Tracking</h1>
            <p className="subtitle">Reception desk can follow up every ticket status in real time.</p>
          </div>
        </div>
      </div>

      <div className="report-content">
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
          <option value="registered">Registered</option>
          <option value="under review">Under Review</option>
          <option value="assigned">Assigned</option>
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
            const isExpanded = expandedId === complaintId;
            const progress = statusProgress(row.status);
            const mediaUrl = buildMediaUrl(row.mediaUri);
            const hasMedia = Boolean(mediaUrl);
            const mediaAvailable = row.mediaAvailable !== false;
            const mediaKind = String(row.mediaKind || '').toLowerCase();
              return (
                <div className="complaint-card" key={String(row._id || row.id || row.ticketNo || Math.random())}>
                <div className="complaint-card-head">
                  <div className="complaint-card-title">{row.ticketNo || 'Ticket'}</div>
                  <span className={statusBadgeClass(row.status)}>{row.status || 'Unknown'}</span>
                </div>

                <div className="complaint-card-meta">
                  <span>Location: {row.locationLabel || row.locationCode || row.flatNumber || '-'}</span>
                  <span>Type: {row.complaintType || 'General'}</span>
                  <span>By: {row.sender?.name || row.sender?.email || row.sender?.phone || '-'}</span>
                </div>

                <p className="complaint-description">{row.description || '-'}</p>

                <div className="complaint-progress-track">
                  <div className="complaint-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="complaint-progress-label">Progress: {progress}%</div>

                <div className="complaint-status-note">
                  <strong>Follow-up Note:</strong> {row.statusNote || 'No note added yet.'}
                </div>
                <div className="complaint-status-note">
                  <strong>Assigned To:</strong> {row.assignedTo || '-'}
                </div>
                {row.residentResolutionRequested ? (
                  <div className="complaint-status-note">
                    <strong>Resident Message:</strong> {row.residentResolutionMessage || '-'}
                    <br />
                    <strong>Sent At:</strong> {formatDateTime(row.residentResolutionAt)}
                  </div>
                ) : null}

                <div className="complaint-view-details-wrap">
                  <button
                    className="complaint-view-details-btn"
                    onClick={() => setExpandedId(isExpanded ? '' : complaintId)}
                  >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="complaint-details-box">
                    <div className="complaint-details-grid">
                      <div><strong>Ticket:</strong> {row.ticketNo || '-'}</div>
                      <div><strong>Flat:</strong> {row.flatNumber || '-'}</div>
                      <div><strong>Location:</strong> {row.locationLabel || row.locationCode || '-'}</div>
                      <div><strong>Type:</strong> {row.complaintType || 'General'}</div>
                      <div><strong>Status:</strong> {row.status || '-'}</div>
                      <div><strong>Assigned To:</strong> {row.assignedTo || '-'}</div>
                      <div><strong>Resident Resolution Flag:</strong> {row.residentResolutionRequested ? 'Yes' : 'No'}</div>
                      <div><strong>Resident Message Time:</strong> {formatDateTime(row.residentResolutionAt)}</div>
                      <div><strong>Raised By:</strong> {row.sender?.name || row.sender?.email || row.sender?.phone || '-'}</div>
                      <div><strong>Sender Role:</strong> {row.sender?.loginType || row.sender?.role || '-'}</div>
                      <div><strong>Created:</strong> {formatDateTime(row.createdAt)}</div>
                      <div><strong>Updated:</strong> {formatDateTime(row.updatedAt)}</div>
                      <div><strong>Media Type:</strong> {row.mediaMimeType || '-'}</div>
                      <div><strong>Resident Message:</strong> {row.residentResolutionMessage || '-'}</div>
                    </div>
                    {hasMedia ? (
                      <div className="complaint-media-wrap">
                        <strong>Attachment:</strong>
                        {mediaAvailable ? (
                          <>
                            {mediaKind === 'video' ? (
                              <video className="complaint-media-preview" controls src={mediaUrl} />
                            ) : (
                              <img className="complaint-media-preview" src={mediaUrl} alt="Complaint attachment" />
                            )}
                            <a className="complaint-media-link" href={mediaUrl} target="_blank" rel="noreferrer">
                              Open full attachment
                            </a>
                          </>
                        ) : (
                          <div className="complaint-media-missing">Attachment file is missing on server. Please ask resident to re-upload.</div>
                        )}
                      </div>
                    ) : (
                      <div className="complaint-media-wrap"><strong>Attachment:</strong> Not available</div>
                    )}
                  </div>
                ) : null}

                {canManage ? (
                  <div className="complaint-manage-box">
                    {isEditing ? (
                      <>
                        <select
                          className="complaint-inline-input"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          <option value="Registered">Registered</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <input
                          className="complaint-inline-input"
                          value={editAssignedTo}
                          onChange={(e) => setEditAssignedTo(e.target.value)}
                          placeholder="Assigned to"
                        />
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

      <div className="report-actions">
        <button className="action-btn export-btn" onClick={handlePrintReport}>💾 Save PDF</button>
        <button className="action-btn print-btn" onClick={handlePrintReport}>🖨️ Print Report</button>
        <button className="action-btn back-dashboard" onClick={onBackToDashboard}>Back to Dashboard</button>
      </div>
    </div>
  );
}

export default ComplaintTracking;
