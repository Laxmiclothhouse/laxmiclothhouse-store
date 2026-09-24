import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { invoicePdfUrl, downloadInvoicePdf, packingSlipUrl, downloadPackingSlip } from '../utils/invoicePdf.js';
import { FLOW, statusMeta, payMeta, nextStatuses, flowStepIndex, ROLE_LABELS, REQUIRED_FIELDS } from '../orderFlow.js';
import { bookDelhiveryShipment, fetchDelhiveryTrack, isDelhiveryOrder, scansStale } from '../utils/delhivery.js';

export default function OrderManage() {
  const { user, isStaff } = useAuth();
  const { orders, updateOrderStatus, addOrderNote, mergeDelhivery, settings } = useData();
  const { id } = useParams();
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [slipOrder, setSlipOrder] = useState(null);
  const [tracking, setTracking] = useState({ courier: '', trackingNo: '', open: false, labelUrl: '' });
  const [noteText, setNoteText] = useState('');
  const [dhlBusy, setDhlBusy] = useState(false);
  const [dhlMsg, setDhlMsg] = useState('');

  // Scoped page: only THIS order is ever shown.
  const order = orders.find((o) => o.id.toLowerCase() === String(id || '').toLowerCase());

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `/order-manage/${id}` }} />;
  }

  const nexts = order && isStaff ? nextStatuses(order.status, user.role) : [];
  const stepIdx = order ? flowStepIndex(order.status) : -1;
  const meta = order ? statusMeta(order.status) : { label: '' };
  const pay = order ? payMeta(order) : { label: '', cls: '' };
  const history = order?.statusHistory || [];
  const notes = order?.notes || [];

  const apply = (status, opts = {}) => {
    if (!order) return;
    if (status === 'cancelled' && !window.confirm(`Cancel order ${order.id}? This cannot be undone.`)) return;
    if (status === 'delivered' && !window.confirm(`Mark order ${order.id} as delivered?`)) return;
    if (status === 'shipped' && !opts.trackingNo) return;
    updateOrderStatus(order.id, status, statusMeta(status).label, {
      ...opts,
      by: { uid: user.id, name: user.name || user.email, role: user.role },
    });
    setTracking({ courier: '', trackingNo: '', open: false });
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    addOrderNote(order.id, noteText, { uid: user.id, name: user.name || user.email, role: user.role });
    setNoteText('');
  };

  // ── Delhivery helpers ──────────────────────────────────────
  // Auto-refresh courier scans when a shipped order is opened
  // (only for Delhivery shipments and only when data is stale).
  useEffect(() => {
    if (!order || !isStaff) return undefined;
    if (order.status !== 'shipped' || !order.trackingNo) return undefined;
    if (!isDelhiveryOrder(order) || !scansStale(order)) return undefined;
    let cancelled = false;
    (async () => {
      const t = await fetchDelhiveryTrack(order.trackingNo);
      if (cancelled || !t.ok) return;
      mergeDelhivery(order.id, {
        awb: t.awb || order.trackingNo,
        status: t.status,
        scans: t.scans || [],
        ndr: Boolean(t.ndr),
        expectedDelivery: t.expectedDelivery || null,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status, order?.delhivery?.lastSyncedAt, isStaff]);

  // Create the waybill via the Delhivery API and pre-fill the ship form.
  const bookPickup = async () => {
    if (dhlBusy) return;
    setDhlBusy(true);
    setDhlMsg('Booking pickup with Delhivery…');
    const r = await bookDelhiveryShipment(order);
    setDhlBusy(false);
    if (!r.ok) {
      setDhlMsg(r.error || 'Booking failed.');
      return;
    }
    setDhlMsg(`Waybill ${r.waybill} created${r.demo ? ' (DEMO MODE — simulated Delhivery, no real shipment)' : ''}. Confirm "Ship" below.`);
    mergeDelhivery(order.id, { awb: r.waybill, labelUrl: r.labelUrl || '' });
    setTracking({ courier: 'Delhivery', trackingNo: r.waybill, open: true, labelUrl: r.labelUrl || '' });
    if (r.labelUrl) window.open(r.labelUrl, '_blank', 'noopener');
  };

  // Pull live scans and offer to apply Delhivery's terminal statuses.
  const syncTracking = async () => {
    if (!order?.trackingNo || dhlBusy) return;
    setDhlBusy(true);
    setDhlMsg('Fetching courier updates…');
    const t = await fetchDelhiveryTrack(order.trackingNo);
    if (!t.ok) {
      setDhlMsg(t.error || 'Tracking unavailable.');
      setDhlBusy(false);
      return;
    }
    mergeDelhivery(order.id, {
      awb: t.awb || order.trackingNo,
      status: t.status,
      scans: t.scans || [],
      ndr: Boolean(t.ndr),
      expectedDelivery: t.expectedDelivery || null,
    });
    setDhlMsg(`Courier status: ${t.status}`);
    if ((t.storeStatus === 'delivered') && t.storeStatus !== order.status) {
      const label = 'Delivered';
      if (window.confirm(`Delhivery reports this parcel as "${t.status}". Mark the order ${label.toLowerCase()}?`)) {
        updateOrderStatus(order.id, t.storeStatus, label, {
          note: `Auto-synced from Delhivery: ${t.status}`,
          by: { uid: user.id, name: user.name || user.email, role: user.role },
        });
      }
    }
    setDhlBusy(false);
  };

  return (
    <main className="page">
      <section className="card-box">
        <h1>Order Management</h1>
        <p className="muted">
          Scoped view for <strong>{id}</strong> — only this order is visible.
        </p>
      </section>

      {!isStaff && (
        <section className="card-box" style={{ borderColor: 'var(--err)' }}>
          <p className="error" style={{ fontSize: '1.02rem', marginBottom: 6 }}>
            ⛔ You have no access to update the status of this order.
          </p>
          <p className="muted small">
            You are signed in as <strong>{user?.email}</strong> ({ROLE_LABELS[user.role] || user.role}).
            Only store staff can change the order status. You may view the details below in read-only mode.
          </p>
        </section>
      )}

      {!order && (
        <section className="card-box">
          <p className="error">Order not found. Please check the order number.</p>
        </section>
      )}

      {order && (
        <section className="card-box">
          <div className="ord-head">
            <strong style={{ fontSize: '1.05rem' }}>Order {order.id}</strong>
            <span className="muted">{formatDateTime(order.orderDate)}</span>
            <span className={`status-badge ${order.status}`}>{meta.label}</span>
            <span className={`pay-badge ${pay.cls}`}>{pay.label}</span>
            <span className="ord-total">{formatINR(order.total)}</span>
          </div>

          {order.trackingNo && (
            <p className="muted" style={{ marginTop: 8 }}>
              📦 {order.courier || 'Courier'} · <strong>{order.trackingNo}</strong>
              {order.delhivery?.expectedDelivery ? ` · ETA ${formatDateTime(order.delhivery.expectedDelivery)}` : ''}
              {isStaff && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={syncTracking}
                    disabled={dhlBusy}
                    title="Refresh live courier status"
                  >
                    {dhlBusy ? 'Syncing…' : '⟳ Sync'}
                  </button>
                </>
              )}
            </p>
          )}

          {dhlMsg && <p className="muted small" style={{ marginTop: 4 }}>{dhlMsg}</p>}

          {isStaff && order.delhivery?.labelUrl && (
            <p style={{ marginTop: 4 }}>
              <a href={order.delhivery.labelUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost">
                🖨 Download shipping label
              </a>
            </p>
          )}

          {isStaff && order.delhivery?.ndr && (
            <p className="error" style={{ marginTop: 6 }}>
              ⚠️ Delivery attempt failed (NDR). Contact the customer to re-attempt delivery.
            </p>
          )}

          {order.delhivery?.scans?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h3 className="muted" style={{ fontSize: '1rem', marginBottom: 6 }}>Courier tracking</h3>
              <p className="muted tiny" style={{ marginBottom: 4 }}>
                Current: <strong>{order.delhivery.status || '—'}</strong>
                {order.delhivery.lastSyncedAt ? ` · synced ${formatDateTime(order.delhivery.lastSyncedAt)}` : ''}
              </p>
              <ul className="audit-list">
                {order.delhivery.scans.map((sc, i) => (
                  <li key={i}>
                    <strong>{sc.status}</strong>
                    {sc.location ? ` · ${sc.location}` : ''}
                    {sc.detail ? ` — ${sc.detail}` : ''}
                    {sc.time ? <span className="muted"> · {formatDateTime(sc.time)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isStaff && (
            <div className="ord-actions" style={{ marginTop: 10 }}>
              <span className="muted">Next step:</span>
              {nexts.length === 0 ? (
                <span className="muted">— (order is {meta.label.toLowerCase()})</span>
              ) : (
                nexts.map((t) =>
                  t === 'shipped' ? (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      onClick={() => setTracking({ courier: '', trackingNo: '', open: true })}
                      title={REQUIRED_FIELDS.shipped ? 'Tracking number is required' : ''}
                    >
                      → {statusMeta(t).label}
                    </button>
                  ) : (
                    <button
                      key={t}
                      type="button"
                      className={`chip ${t === 'cancelled' ? 'danger' : ''}`}
                      onClick={() => apply(t)}
                    >
                      → {statusMeta(t).label}
                    </button>
                  )
                )
              )}
              {order.status === 'packed' && (
                <button
                  type="button"
                  className="chip"
                  onClick={bookPickup}
                  disabled={dhlBusy}
                  title="Create the waybill via the Delhivery API (before the token is added, book in the Delhivery panel and enter the AWB manually)"
                >
                  🚚 Book Delhivery pickup
                </button>
              )}
            </div>
          )}

          {isStaff && tracking.open && (
            <div className="track-form" style={{ marginTop: 8 }}>
              <strong className="muted">Ship {order.id}:</strong>
              <input
                value={tracking.courier}
                onChange={(e) => setTracking({ ...tracking, courier: e.target.value })}
                placeholder="Courier (e.g. Delhivery)"
                aria-label="Courier name"
              />
              <input
                value={tracking.trackingNo}
                onChange={(e) => setTracking({ ...tracking, trackingNo: e.target.value })}
                placeholder="Tracking number *"
                aria-label="Tracking number"
                required
              />
              <button
                type="button"
                className="btn btn-sm btn-gold"
                disabled={!tracking.trackingNo.trim()}
                onClick={() => apply('shipped', { courier: tracking.courier.trim(), trackingNo: tracking.trackingNo.trim() })}
              >
                ✓ Ship
              </button>
              {tracking.labelUrl && (
                <a href={tracking.labelUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost">
                  🖨 Label
                </a>
              )}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setTracking({ ...tracking, open: false })}>
                Cancel
              </button>
            </div>
          )}

          {isStaff && (
            <div className="ord-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setInvoiceOrder(order)}>
                🧾 View Invoice
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSlipOrder(order)}>
                📦 Packing Slip
              </button>
            </div>
          )}

          {stepIdx >= 0 && (
            <div className="tl-row" style={{ marginTop: 16 }}>
              {FLOW.map((t, i) => (
                <div key={t.status} className={`tl-step ${i < stepIdx ? 'done' : i === stepIdx ? 'current' : ''}`}>
                  <div className="tl-dot">{i < stepIdx ? '✓' : i + 1}</div>
                  <strong>{t.label}</strong>
                </div>
              ))}
            </div>
          )}{history.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3 className="muted" style={{ fontSize: '1rem', marginBottom: 6 }}>Audit trail</h3>
              <ul className="audit-list">
                {[...history].reverse().map((h, i) => (
                  <li key={i}>
                    <strong>{h.label}</strong>
                    {h.by?.name ? ` · ${h.by.name}` : ''}
                    {h.by?.role ? ` (${ROLE_LABELS[h.by.role] || h.by.role})` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                    <span className="muted"> · {formatDateTime(h.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isStaff && (
            <div style={{ marginTop: 14 }}>
              <h3 className="muted" style={{ fontSize: '1rem', marginBottom: 6 }}>Staff notes</h3>
              <textarea
                rows={2}
                className="note-input"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Internal note for your team (not shown to the customer)…"
              />
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  onClick={addNote}
                  disabled={!noteText.trim()}
                >
                  + Add note
                </button>
              </div>
              {notes.length > 0 && (
                <ul className="audit-list" style={{ marginTop: 6 }}>
                  {[...notes].reverse().map((nt) => (
                    <li key={nt.id}>
                      {nt.by?.name ? `${nt.by.name}: ` : ''}{nt.note}
                      <span className="muted"> · {formatDateTime(nt.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="ord-body" style={{ marginTop: 14 }}>
            <div>
              <p className="muted">{order.customer?.name} · {order.customer?.phone}</p>
              <p className="muted">
                {order.shipping?.address}, {order.shipping?.city}, {order.shipping?.state} — {order.shipping?.pincode}
              </p>
              <ul className="sum-items">
                {order.items.map((it) => (
                  <li key={it.id}>
                    <span>{it.name} × {it.qty}</span>
                    <span className="muted">{formatINR(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-box inner">
              <h3>Payment</h3>
              <p>
                <strong>{order.payment?.mode}</strong> ·{' '}
                {order.payment?.status === 'paid' ? 'Paid' : 'Pending (COD)'}
              </p>
              {order.payment?.gateway && <p className="muted tiny">{order.payment.gateway}</p>}
              <div className="sum-lines">
                <div><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
                <div><span>Shipping</span><span>{order.shippingFee > 0 ? formatINR(order.shippingFee) : 'FREE'}</span></div>
                <div><span>Total</span><span>{formatINR(order.total)}</span></div>
              </div>
              {order.refundInfo && (
                <p className="muted tiny" style={{ marginTop: 6 }}>
                  Refund: {order.refundInfo.type === 'razorpay_refund' ? 'initiated' : order.refundInfo.note || '—'}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {invoiceOrder && (
        <ManageInvoiceModal order={invoiceOrder} settings={settings} onClose={() => setInvoiceOrder(null)} />
      )}

      {slipOrder && (
        <PackSlipModal order={slipOrder} settings={settings} onClose={() => setSlipOrder(null)} />
      )}
    </main>
  );
}function ManageInvoiceModal({ order, settings, onClose }) {
  const [url, setUrl] = useState('');
  React.useEffect(() => {
    let u = null;
    invoicePdfUrl(order, settings).then((v) => {
      u = v;
      setUrl(v);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [order, settings]);
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card invoice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
        <div className="modal-head">
          <h2>Invoice — {order.id}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <div className="row-gap" style={{ marginBottom: 12 }}>
            <span className="muted">{formatDateTime(order.orderDate)} · {formatINR(order.total)}</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm btn-gold" onClick={() => downloadInvoicePdf(order, settings)}>
              ⬇ Download PDF
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
          </div>
          {url ? (
            <iframe
              title={`Invoice ${order.id}`}
              src={url}
              style={{ width: '100%', height: 520, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}
            />
          ) : (
            <p className="muted">Preparing PDF…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PackSlipModal({ order, settings, onClose }) {
  const [url, setUrl] = useState('');
  React.useEffect(() => {
    let u = null;
    packingSlipUrl(order, settings).then((v) => {
      u = v;
      setUrl(v);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [order, settings]);
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card invoice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <h2>Packing slip — {order.id}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <div className="row-gap" style={{ marginBottom: 12 }}>
            <span className="muted">Pick list for the warehouse</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm btn-gold" onClick={() => downloadPackingSlip(order, settings)}>
              ⬇ Download PDF
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
          </div>
          {url ? (
            <iframe
              title={`Packing slip ${order.id}`}
              src={url}
              style={{ width: '100%', height: 520, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}
            />
          ) : (
            <p className="muted">Preparing PDF…</p>
          )}
        </div>
      </div>
    </div>
  );
}
