import React, { useState } from 'react';

const TYPES = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'sale_start', label: 'Sale starting' },
  { value: 'flash_sale', label: 'Flash sale ending' },
  { value: 'maintenance', label: 'Maintenance window' },
  { value: 'new_arrival', label: 'New arrivals' },
];

const typeLabel = (t) => TYPES.find((x) => x.value === t)?.label || t;

export default function AlertsManager({ alerts = [], addAlert, updateAlert, deleteAlert, toggleAlert }) {
  const [form, setForm] = useState({
    type: 'announcement',
    message: '',
    startsAt: '',
    endsAt: '',
    active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const needsStart = form.type === 'sale_start' || form.type === 'maintenance';
  const needsEnd = form.type === 'flash_sale' || form.type === 'maintenance' || form.type === 'announcement' || form.type === 'new_arrival';

  const reset = () => {
    setForm({ type: 'announcement', message: '', startsAt: '', endsAt: '', active: true });
    setEditingId(null);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setSaving(true);
    const payload = {
      type: form.type,
      message: form.message.trim(),
      startsAt: needsStart ? form.startsAt : '',
      endsAt: needsEnd ? form.endsAt : '',
      active: form.active,
    };
    if (editingId) updateAlert(editingId, payload);
    else addAlert(payload);
    setSaving(false);
    reset();
    setShowForm(false);
  };

  const startEdit = (a) => {
    setShowForm(true);
    setEditingId(a.id);
    setForm({
      type: a.type || 'announcement',
      message: a.message || '',
      startsAt: a.startsAt || '',
      endsAt: a.endsAt || '',
      active: a.active !== false,
    });
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Alerts & announcements</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Create site-wide alerts. Fields change based on the alert type; times are optional where not required.
      </p>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search alerts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, minWidth: 180 }}
        />
        {!showForm && (
          <button type="button" className="btn btn-gold" onClick={() => setShowForm(true)}>+ Add alert</button>
        )}
      </div>
      {showForm && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <label>
            Alert type
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            Message
            <input
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="e.g. Big festive sale starts soon!"
              required
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {needsStart && (
            <label>
              Start time
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                required={form.type === 'sale_start' || form.type === 'maintenance'}
              />
            </label>
          )}
          {needsEnd && (
            <label>
              {form.type === 'flash_sale' ? 'End time' : 'Ends / expires (optional)'}
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                required={form.type === 'flash_sale' || form.type === 'maintenance'}
              />
            </label>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            style={{ width: 'auto' }}
          />
          Active
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn" disabled={saving}>
            {editingId ? 'Update alert' : 'Add alert'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-outline" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {alerts.filter((a) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          return String(a.message || '').toLowerCase().includes(q) || String(a.type || '').toLowerCase().includes(q);
        }).length === 0 && <p className="muted">No alerts yet.</p>}
        {alerts
          .filter((a) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return String(a.message || '').toLowerCase().includes(q) || String(a.type || '').toLowerCase().includes(q);
          })
          .map((a) => (
          <div
            key={a.id}
            style={{
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              opacity: a.active === false ? 0.55 : 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>
                {typeLabel(a.type)} {a.active === false && <span className="muted">(inactive)</span>}
              </div>
              <div>{a.message}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {a.startsAt && <>Starts: {new Date(a.startsAt).toLocaleString()} </>}
                {a.endsAt && <>� Ends: {new Date(a.endsAt).toLocaleString()}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => toggleAlert(a.id)}>
                {a.active === false ? 'Enable' : 'Disable'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => startEdit(a)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteAlert(a.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
