import { useEffect, useState } from 'react';
import './FamilyDetails.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://my-chsapi.onrender.com';

function FamilyDetails({ onBackToDashboard, onRequireLogin }) {
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ residentName: '', flatNumber: '', familyMembers: [] });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user && onRequireLogin) {
      onRequireLogin();
    }
  }, [onRequireLogin]);

  const fetchFamilyRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const res = await fetch(`${API_BASE_URL}/api/family?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setRecords(Array.isArray(data.records) ? data.records : []);
      } else {
        setError(data.message || 'Failed to fetch family details.');
      }
    } catch (_err) {
      setError('Failed to fetch family details.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFamilyRecords();

    const intervalId = setInterval(() => {
      fetchFamilyRecords();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchFamilyRecords();
  };

  const openEditModal = (record) => {
    const members = Array.isArray(record.familyMembers) ? record.familyMembers : [];
    setEditingRecord(record);
    setEditForm({
      residentName: record.residentName || '',
      flatNumber: record.flatNumber || '',
      familyMembers: members.map((m) => ({
        memberName: m.memberName || '',
        relation: m.relation || '',
        cnic: m.cnic || '',
        phone: m.phone || '',
      })),
    });
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setEditForm({ residentName: '', flatNumber: '', familyMembers: [] });
    setSavingEdit(false);
  };

  const updateEditMember = (index, key, value) => {
    setEditForm((prev) => ({
      ...prev,
      familyMembers: prev.familyMembers.map((m, i) => (i === index ? { ...m, [key]: value } : m)),
    }));
  };

  const addEditMember = () => {
    setEditForm((prev) => ({
      ...prev,
      familyMembers: [...prev.familyMembers, { memberName: '', relation: '', cnic: '', phone: '' }],
    }));
  };

  const removeEditMember = (index) => {
    setEditForm((prev) => ({
      ...prev,
      familyMembers: prev.familyMembers.filter((_, i) => i !== index),
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRecord?._id) return;

    const residentName = editForm.residentName.trim();
    const flatNumber = editForm.flatNumber.trim();
    if (!residentName || !flatNumber) {
      setError('Resident name and flat number are required for update.');
      return;
    }

    setSavingEdit(true);
    setError('');
    try {
      const payload = {
        residentName,
        flatNumber,
        familyMembers: editForm.familyMembers,
      };
      const res = await fetch(`${API_BASE_URL}/api/family/${editingRecord._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update family details.');
      }
      closeEditModal();
      fetchFamilyRecords();
    } catch (err) {
      setError(err.message || 'Failed to update family details.');
    }
    setSavingEdit(false);
  };

  return (
    <div className="family-report-container">
      <div className="bg-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
      </div>

      <div className="family-report-header">
        <div className="family-report-title">
          <button className="back-btn" onClick={onBackToDashboard}>
            ←
          </button>
          <div>
            <h1>Family Details</h1>
            <p className="subtitle">View uploaded family CNIC records</p>
          </div>
        </div>
      </div>

      <div className="family-report-content">
        <div className="family-filters-section">
          <form className="family-filter-row" onSubmit={handleSearch}>
            <div className="family-search-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by resident name, flat number, file name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="family-search-input"
              />
            </div>
            <button className="family-search-btn" type="submit">Search</button>
            <button className="family-refresh-btn" type="button" onClick={fetchFamilyRecords}>Refresh</button>
          </form>
          <div className="family-results-count">
            {loading ? 'Loading...' : `Showing ${records.length} records`}
            {error && <span className="family-error">{error}</span>}
          </div>
        </div>

        <div className="family-table-wrapper">
          <table className="family-report-table">
            <thead>
              <tr>
                <th>Resident Name</th>
                <th>Flat Number</th>
                <th>Members</th>
                <th>CNIC PDF</th>
                <th>Uploaded At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((record) => {
                  const members = Array.isArray(record.familyMembers) ? record.familyMembers : [];
                  const uploadedAt = record.uploadedAt
                    ? new Date(record.uploadedAt).toLocaleString()
                    : '-';

                  return (
                    <tr key={String(record._id || `${record.flatNumber}-${record.uploadedAt}`)}>
                      <td>{record.residentName || '-'}</td>
                      <td>{record.flatNumber || '-'}</td>
                      <td>{members.length}</td>
                      <td>
                        {record.fileUrl ? (
                          <a href={record.fileUrl} target="_blank" rel="noreferrer" className="family-file-link">
                            {record.fileName || 'Open PDF'}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{uploadedAt}</td>
                      <td>
                        <button className="family-edit-btn" onClick={() => openEditModal(record)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="family-no-results">No family records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRecord && (
        <div className="family-edit-overlay" onClick={closeEditModal}>
          <div className="family-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="family-edit-header">
              <h3>Edit Family Details</h3>
              <button className="family-close-btn" onClick={closeEditModal}>×</button>
            </div>

            <form onSubmit={handleSaveEdit} className="family-edit-form">
              <div className="family-edit-grid">
                <label>
                  Resident Name
                  <input
                    type="text"
                    value={editForm.residentName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, residentName: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Flat Number
                  <input
                    type="text"
                    value={editForm.flatNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, flatNumber: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="family-members-edit-wrap">
                <div className="family-members-edit-head">
                  <strong>Family Members</strong>
                  <button type="button" className="family-add-member-btn" onClick={addEditMember}>+ Add Member</button>
                </div>

                {editForm.familyMembers.map((member, index) => (
                  <div className="family-member-edit-card" key={`edit-member-${index}`}>
                    <input
                      type="text"
                      placeholder="Member Name"
                      value={member.memberName}
                      onChange={(e) => updateEditMember(index, 'memberName', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Relation"
                      value={member.relation}
                      onChange={(e) => updateEditMember(index, 'relation', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="CNIC"
                      value={member.cnic}
                      onChange={(e) => updateEditMember(index, 'cnic', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={member.phone}
                      onChange={(e) => updateEditMember(index, 'phone', e.target.value)}
                    />
                    <button type="button" className="family-remove-member-btn" onClick={() => removeEditMember(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="family-edit-actions">
                <button type="button" className="family-cancel-btn" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="family-save-btn" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FamilyDetails;
