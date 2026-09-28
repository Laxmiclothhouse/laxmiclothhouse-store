import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, formatDateTime } from '../utils/format.js';
import { FLOW, statusMeta, payMeta, nextStatuses, REQUIRED_FIELDS, roleQueueScope } from '../orderFlow.js';

/**
 * Staff orders queue with role-aware workflow guards, payment badges,
 * quick filtering and an inline tracking form for shipments.
 * `onUpdate(order, status, opts)` is supplied by the parent (DataContext).
 *
 * Role scoping: packers see ONLY orders waiting to be packed (confirmed),
 * shippers ONLY orders waiting to be shipped (packed). Admin/manager/support
 * get the full board with filter chips.
 */
export default function OrdersQueue({ orders, role, user, onUpdate, onInvoice, onPackSlip, initialFilter = 'all' }) {
  const scope = roleQueueScope(role);
  const [filter, setFilter] = useState(initialFilter && initialFilter !== 'all' ? initialFilter : 'all');
  const [todayOnly, setTodayOnly] = useState(false);
  const [q, setQ] = useState('');
  const [shippingId, setShippingId] = useState(null);
  const [tf, setTf] = useState({ courier: '', trackingNo: '' });

  const all = [...(orders || [])].sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
  // Locked scope for packer/shipper — they only ever see their own queue.
  const list = scope ? all.filter((o) => scope.statuses.includes(o.status)) : all;

  // "Today" mode: each chip then answers "which orders reached THIS status
  // today?" — e.g. Today + Confirmed = orders confirmed today, Today +
  // Order Placed = orders placed today.
  const dayKey = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const todayKey = dayKey(new Date().toISOString());
  const enteredStatusAt = (o) => {
    const history = o.statusHistory || [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i] && history[i].status === o.status) return history[i].at;
    }
    return o.orderDate; // legacy orders: fall back to placement time
  };
  const dateScoped = todayOnly
    ? list.filter((o) => dayKey(enteredStatusAt(o)) === todayKey)
    : list;

  const counts = { all: dateScoped.length };
  dateScoped.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
  counts.unpaid = dateScoped.filter((o) => !payMeta(o).paid).length;

  const filtered = dateScoped.filter((o) => {
    if (filter !== 'all') {
      if (filter === 'unpaid') {
        if (payMeta(o).paid) return false;
      } else if (o.status !== filter) {
        return false;
      }
    }
    if (q) {
      const hay = [
        o.id,
        o.customer?.name,
        o.customer?.phone,
        o.customer?.email,
        o.customerEmail,
        o.shipping?.city,
        o.shipping?.address,
      ].join(' ').toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const chips = [
    { id: 'all', label: `All (${counts.all || 0})` },
    ...FLOW.map((s) => ({ id: s.status, label: `${s.label} (${counts[s.status] || 0})` })),
    { id: 'cancelled', label: `Cancelled (${counts.cancelled || 0})` },
    { id: 'unpaid', label: `Unpaid (${counts.unpaid || 0})`, warn: true },
    { id: 'today', label: todayOnly ? 'Today ✓' : 'Today', toggle: true },
  ];

  const openShipping = (o) => {
    setShippingId(o.id);
    setTf({ courier: o.courier || '', trackingNo: o.trackingNo || '' });
  };

  const apply = (o, status, opts = {}) => {
    let withNote = opts;
    if (status === 'cancelled') {
      // Admin must give a reason — it is stored on the order and sent to
      // the customer inside the WhatsApp cancellation message.
      const reason = window.prompt(
        `Cancel order ${o.id}? This cannot be undone.\n\nReason for cancelling (required — the customer sees this):`
      );
      if (reason === null) return;
      if (!String(reason).trim()) {
        window.alert('A cancellation note is required.');
        return;
      }
      withNote = { ...opts, note: String(reason).trim() };
    }
    if (status === 'delivered' && !window.confirm(`Mark order ${o.id} as delivered?`)) return;
    const payload = {
      ...withNote,
      by: { uid: user?.id, name: user?.name || user?.email, role: user?.role },
    };
    if (status === 'shipped' && !payload.trackingNo) return;
    onUpdate(o, status, payload);
    setShippingId(null);
  };

  const nextsFor = (o) => nextStatuses(o.status, role);

  return (
    <div>
      {scope ? (
        <p className="muted" style={{ marginTop: 4 }}>
          <strong>{scope.title} ({filtered.length})</strong> — you only see the orders waiting for your step.
        </p>
      ) : (
        <div className="filter-chips">
          {chips.map((c) => {
            const isActive = c.toggle ? todayOnly : filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${isActive ? 'active' : ''}${c.warn ? ' danger' : ''}`}
                onClick={() => (c.toggle ? setTodayOnly((v) => !v) : setFilter(c.id))}
                title={c.toggle ? 'Show only orders that reached the selected status today' : ''}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      <input
        className="queue-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search order ID, name, phone, city…"
      />

      {filtered.length === 0 ? (
        <p className="muted">{scope ? scope.empty : (todayOnly ? 'No orders reached this status today.' : 'No orders match this filter.')}</p>
      ) : (
        <div className="orders-list">
          {filtered.map((o) => {
            const meta = statusMeta(o.status);
            const pay = payMeta(o);
            const nexts = nextsFor(o);
            const history = o.statusHistory || [];
            const last = history[history.length - 1];
            return (
              <div className="order-row" key={o.id}>
                <div className="ord-head">
                  <Link to={`/order-manage/${o.id}`} className="ord-id-link" style={{ fontWeight: 700 }}>
                    Order {o.id}
                  </Link>
                  <span className="muted">{formatDateTime(o.orderDate)}</span>
                  <span className={`status-badge ${o.status}`}>{meta.label}</span>
                  <span className={`pay-badge ${pay.cls}`}>{pay.label}</span>
                  <span className="ord-total">{formatINR(o.total)}</span>
                </div>

                <div className="ord-body">
                  <div>
                    <p className="muted">
                      {o.customer?.name} · {o.customer?.phone}
                      {o.customer?.email ? ` · ${o.customer.email}` : ''}
                    </p>
                    <p className="muted">
                      {o.shipping?.address}, {o.shipping?.city}, {o.shipping?.state} — {o.shipping?.pincode}
                    </p>
                    <ul className="sum-items">
                      {o.items.slice(0, 3).map((it) => (
                        <li key={it.id || it.name}>
                          <span>{it.name} × {it.qty}</span>
                          <span className="muted">{formatINR(it.price * it.qty)}</span>
                        </li>
                      ))}
                      {o.items.length > 3 && (
                        <li key="more"><span className="muted">+ {o.items.length - 3} more item(s)</span></li>
                      )}
                    </ul>
                    {last && (
                      <p className="muted tiny" style={{ marginTop: 4 }}>
                        {last.by ? `${last.by.name} ` : ''}→ {last.label} · {formatDateTime(last.at)}
                      </p>
                    )}
                    {o.trackingNo && (
                      <p className="muted tiny">📦 {o.courier || 'Courier'} · {o.trackingNo}</p>
                    )}
                  </div>

                  <div className="ord-actions">
                    {nexts.map((t) =>
                      t === 'shipped' ? (
                        <button
                          key={t}
                          type="button"
                          className="chip"
                          onClick={() => openShipping(o)}
                          title={REQUIRED_FIELDS.shipped ? 'Tracking number is required' : ''}
                        >
                          → {statusMeta(t).label}
                        </button>
                      ) : (
                        <button
                          key={t}
                          type="button"
                          className={`chip ${t === 'cancelled' ? 'danger' : ''}`}
                          onClick={() => apply(o, t, {})}
                        >
                          → {statusMeta(t).label}
                        </button>
                      )
                    )}
                    <Link to={`/order-manage/${o.id}`} className="linklike">Open manage →</Link>
                    <button type="button" className="linklike" onClick={() => onInvoice(o)}>🧾 Invoice</button>
                    {onPackSlip && <button type="button" className="linklike" onClick={() => onPackSlip(o)}>📦 Slip</button>}
                  </div>
                </div>

                {shippingId === o.id && (
                  <div className="track-form">
                    <strong className="muted">Mark shipped:</strong>
                    <input
                      value={tf.courier}
                      onChange={(e) => setTf({ ...tf, courier: e.target.value })}
                      placeholder="Courier (e.g. Delhivery)"
                      aria-label="Courier name"
                    />
                    <input
                      value={tf.trackingNo}
                      onChange={(e) => setTf({ ...tf, trackingNo: e.target.value })}
                      placeholder="Tracking number *"
                      aria-label="Tracking number"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-gold"
                      disabled={!tf.trackingNo.trim()}
                      onClick={() => apply(o, 'shipped', { courier: tf.courier.trim(), trackingNo: tf.trackingNo.trim() })}
                    >
                      ✓ Ship
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShippingId(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}