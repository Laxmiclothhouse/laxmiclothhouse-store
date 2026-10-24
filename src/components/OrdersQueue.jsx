import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { FLOW, statusMeta, payMeta, nextStatuses, REQUIRED_FIELDS, roleQueueScope, refundState } from '../orderFlow.js';
import Paginator from './Paginator.jsx';

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
  const { deleteRecords } = useData();
  const navigate = useNavigate();
  const scope = roleQueueScope(role);
  const [filter, setFilter] = useState(initialFilter && initialFilter !== 'all' ? initialFilter : 'all');
  const [todayOnly, setTodayOnly] = useState(false);
  const [range, setRange] = useState('90');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [shippingId, setShippingId] = useState(null);
  const [tf, setTf] = useState({ courier: '', trackingNo: '' });
  const deletePastOrders = () => {
    const dateStr = window.prompt('Delete all orders placed on or before this date (YYYY-MM-DD):');
    if (!dateStr) return;
    const cutoff = new Date(`${dateStr}T23:59:59.999`);
    if (Number.isNaN(cutoff.getTime())) {
      window.alert('Invalid date. Use YYYY-MM-DD.');
      return;
    }
    const candidates = (orders || []).filter((o) => {
      const d = new Date(o.orderDate || o.createdAt);
      return !Number.isNaN(d.getTime()) && d <= cutoff;
    });
    if (!candidates.length) {
      window.alert('No orders found on or before that date.');
      return;
    }
    deleteRecords('orders', candidates.map((o) => o.id));
  };

  const all = [...(orders || [])].sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
  // Locked scope for packer/shipper — they only ever see their own queue.
  const list = scope ? all.filter((o) => scope.statuses.includes(o.status)) : all;

  // Date-range guard: by default only show recent orders so lakhs of historical
  // records do not have to be rendered/filtered in the browser.
  const rangeCutoff = range === 'all' ? null : (() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const inRange = (o) => {
    if (!rangeCutoff) return true;
    const d = new Date(o.orderDate || o.createdAt);
    return !Number.isNaN(d.getTime()) && d >= rangeCutoff;
  };
  const rangedList = list.filter(inRange);

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
    ? rangedList.filter((o) => dayKey(enteredStatusAt(o)) === todayKey)
    : rangedList;

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

  // Pagination: jump back to page 1 whenever the filters change, then slice.
  useEffect(() => {
    setPage(1);
  }, [filter, q, todayOnly, pageSize, range]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  const archiveOldOrders = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    cutoff.setHours(0, 0, 0, 0);
    const candidates = (orders || []).filter((o) => {
      const d = new Date(o.orderDate || o.createdAt);
      if (Number.isNaN(d.getTime()) || d >= cutoff) return false;
      return ['delivered', 'cancelled', 'refunded'].includes(String(o.status || ''));
    });
    if (!candidates.length) {
      window.alert('No delivered/cancelled/refunded orders older than 90 days to archive.');
      return;
    }
    if (!window.confirm(`Archive ${candidates.length} old completed orders? A CSV backup will be downloaded first, then they are removed from the active queue.`)) return;

    // Download CSV backup
    const header = ['id', 'orderDate', 'status', 'customer', 'phone', 'total'];
    const rows = candidates.map((o) => [
      o.id,
      o.orderDate || '',
      o.status || '',
      (o.customer?.name || o.customerName || '').replace(/,/g, ' '),
      (o.customer?.phone || o.phone || '').replace(/,/g, ' '),
      o.total ?? '',
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-archive-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    deleteRecords('orders', candidates.map((o) => o.id));
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
      <select
        className="queue-range"
        value={range}
        onChange={(e) => setRange(e.target.value)}
        title="Limit orders by date"
        style={{ marginLeft: 8 }}
      >
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="365">Last 1 year</option>
        <option value="all">All orders</option>
      </select>
      {filtered.length === 0 ? (
        <p className="muted">{scope ? scope.empty : (todayOnly ? 'No orders reached this status today.' : 'No orders match this filter.')}</p>
      ) : (
        <>
          <div className="orders-list">
          {paged.map((o) => {
            const meta = statusMeta(o.status);
            const nexts = nextsFor(o);
            return (
              <div
                className="order-row"
                key={o.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/order-manage/${o.id}`)}
              >
                <div className="ord-head">
                  <Link to={`/order-manage/${o.id}`} className="linklike" style={{ fontWeight: 700 }} onClick={(e) => e.stopPropagation()}>
                    {o.id}
                  </Link>
                  <span className="muted">{formatDateTime(o.orderDate)}</span>
                  <span className={`status-badge ${o.status}`}>{meta.label}</span>
                  {(() => {
                    const rs = refundState(o);
                    return (
                      <>
                        {o.status === 'cancelled' && rs === 'refunding' && (
                          <span className="refund-badge refunding">Refunding in process</span>
                        )}
                        {o.status === 'cancelled' && rs === 'refunded' && (
                          <span className="refund-badge refunded">Refunded</span>
                        )}
                        {o.status === 'refunded' && (
                          <span className="refund-badge refunded">Amount Refunded</span>
                        )}
                        {o.status === 'cancelled' && rs === 'failed' && (
                          <span className="refund-badge failed">Refund failed — contact support</span>
                        )}
                      </>
                    );
                  })()}
                  <span className="ord-total">{formatINR(o.total)}</span>
                </div>

                <div className="ord-body">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="muted">
                      {o.customer?.name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                    </p>
                    {o.trackingNo && (
                      <p className="muted tiny">📦 {o.courier || 'Courier'} · {o.trackingNo}</p>
                    )}
                    {/* Product images + details for this order */}
                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <ul className="sum-items" style={{ marginTop: 8 }}>
                        {o.items.map((it, idx) => (
                          <li key={it.id || idx} style={{ alignItems: 'center' }}>
                            {it.image ? (
                              <img
                                src={it.image}
                                alt={it.name || 'Product'}
                                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f2e8ec', display: 'grid', placeItems: 'center', fontSize: '.7rem', color: '#999', flexShrink: 0 }}>
                                No img
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, wordBreak: 'break-word' }}>
                                {it.name || 'Product'}
                              </div>
                              <div className="muted tiny">
                                {[it.colorName || it.color, it.size ? `Size ${it.size}` : '', it.sku ? `SKU ${it.sku}` : '']
                                  .filter(Boolean)
                                  .join(' · ')}
                                {it.qty ? ` · Qty ${it.qty}` : ''}
                              </div>
                            </div>
                            <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                              {formatINR((Number(it.price) || 0) * (Number(it.qty) || 1))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="ord-actions" onClick={(e) => e.stopPropagation()}>
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
                    {onPackSlip && <button type="button" className="linklike" onClick={() => onPackSlip(o)}>📦 Slip</button>}
                  </div>
                </div>

                {shippingId === o.id && (
                  <div className="track-form" onClick={(e) => e.stopPropagation()}>
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
          <Paginator
            total={filtered.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            unit="orders"
          />
        </>
      )}
    </div>
  );
}