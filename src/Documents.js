import { useEffect, useState } from 'react';
import './Report.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

const buildFileUrl = (value) => {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
};

function Documents({ onBackToDashboard, onRequireLogin }) {
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user && onRequireLogin) {
      onRequireLogin();
    }
  }, [onRequireLogin]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const response = await fetch(`${API_BASE_URL}/api/documents?${params.toString()}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch documents.');
      }
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err) {
      setRecords([]);
      setError(err.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    const intervalId = setInterval(fetchDocuments, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setError('');
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const rowsHtml = records.length
      ? records
          .map((record) => {
            const fileUrl = buildFileUrl(record.filePath || record.fileUrl);
            return `
              <tr>
                <td>${record.ownerName || '-'}</td>
                <td>${record.flatNumber || '-'}</td>
                <td>${fileUrl ? (record.fileName || 'Open PDF') : '-'}</td>
                <td>${record.uploadedAt ? new Date(record.uploadedAt).toLocaleString() : '-'}</td>
              </tr>
            `;
          })
          .join('')
      : '<tr><td colspan="4" style="text-align:center; padding:16px;">No records found</td></tr>';

    const printedAt = new Date().toLocaleString();

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Documents Report</title>
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
          <h1>Documents Report</h1>
          <div class="meta">Printed: ${printedAt}</div>
          <div class="meta">Records: ${records.length}</div>
          <table>
            <thead>
              <tr>
                <th>Owner Name</th>
                <th>Flat Number</th>
                <th>Document</th>
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

  const handleSaveDocument = async (record) => {
    const fileUrl = buildFileUrl(record.filePath || record.fileUrl);
    if (!fileUrl) return;

    const fallbackName = `document-${record.flatNumber || 'flat'}-${Date.now()}.pdf`;
    const rawName = String(record.fileName || fallbackName).trim();
    const fileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    try {
      const response = await fetch(fileUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
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
            <h1>Documents</h1>
            <p className="subtitle">View uploaded resident documents</p>
          </div>
        </div>
      </div>

      <div className="report-content">
        <div className="filters-section">
          <form className="filter-row" onSubmit={handleSearch}>
            <div className="search-group">
              <label>Search</label>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by owner name, flat number, file name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <button className="clear-btn" type="button" onClick={handleClearFilters}>
              Clear
            </button>
            <button className="search-btn" type="submit">🔍 Search</button>
            <button className="refresh-btn" type="button" onClick={fetchDocuments}>🔄 Refresh</button>
          </form>

          <div className="results-count">
            {loading ? 'Loading...' : `Showing ${records.length} records`}
            {error && <span style={{ color: 'red', marginLeft: 10 }}>{error}</span>}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="visitors-report-table">
            <thead>
              <tr>
                <th>Owner Name</th>
                <th>Flat Number</th>
                <th>Document</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((record) => {
                  const fileUrl = buildFileUrl(record.filePath || record.fileUrl);
                  const fileAvailable = record.fileAvailable !== false;
                  return (
                    <tr key={String(record._id || `${record.flatNumber}-${record.uploadedAt}`)}>
                      <td className="name-en-cell">{record.ownerName || '-'}</td>
                      <td className="emirates-id-cell">{record.flatNumber || '-'}</td>
                      <td>
                        {fileUrl ? (
                          fileAvailable ? (
                            <div className="table-doc-actions">
                              <a href={fileUrl} target="_blank" rel="noreferrer" className="cnic-scan-link">
                                {record.fileName || 'Open PDF'}
                              </a>
                              <button type="button" className="table-save-btn" onClick={() => handleSaveDocument(record)}>
                                Save PDF
                              </button>
                            </div>
                          ) : (
                            <span className="cnic-scan-link" style={{ color: '#fca5a5' }}>File missing</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{record.uploadedAt ? new Date(record.uploadedAt).toLocaleString() : '-'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="no-results">No documents found matching your criteria</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-actions">
        <button className="action-btn export-btn" onClick={handlePrintReport}>
          💾 Save PDF
        </button>
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

export default Documents;
