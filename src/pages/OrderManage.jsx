import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { invoicePdfUrl, downloadInvoicePdf, printInvoicePdf } from '../utils/invoicePdf.js';
import { FLOW, statusMeta, payMeta, nextStatuses, flowStepIndex, ROLE_LABELS, REQUIRED_FIELDS, refundState } from '../orderFlow.js';
import { bookDelhiveryShipment, fetchDelhiveryTrack, isDelhiveryOrder, scansStale } from '../utils/delhivery.js';
import PdfViewer from '../components/PdfViewer.jsx';

export default function OrderManage() {
  const { user, isStaff } = useAuth();
  const { orders, updateOrderStatus, addOrderNote, mergeDelhivery, markOrderRefunded, settings } = useData();
  const { id } = useParams();
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [tracking, setTracking] = useState({ courier: '', trackingNo: '', open: false, labelUrl: '' });
  const [noteText, setNoteText] = useState('');
  const [dhlBusy, setDhlBusy] = useState(false);
  const [dhlMsg, setDhlMsg] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundMsg, setRefundMsg] = useState('');
  const [refundChecking, setRefundChecking] = useState(false);

  // Scoped page: only THIS order is ever shown.
  const order = orders.find((o) => o.id.toLowerCase() === String(id || '').toLowerCase());

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `/order-manage/${id}` }} />;
  }

  const nexts = order && isStaff ? nextStatuses(order.status, user.role) : [];
  const stepIdx = order ? flowStepIndex(order.status) : -1;
  const meta = order ? statusMeta(order.status) : { label: '' };
  const history = order?.statusHistory || [];
  const notes = order?.notes || [];

  const apply = (status, opts = {}) => {
    if (!order) return;
    let withNote = opts;
    if (status === 'cancelled') {
      // Admin must give a reason — it is stored on the order and sent to
      // the customer inside the WhatsApp cancellation message.
      const reason = window.prompt(
        `Cancel order ${order.id}? This cannot be undone.\n\nReason for cancelling (required — the customer sees this):`
      );
      if (reason === null) return;
      if (!String(reason).trim()) {
        window.alert('A cancellation note is required.');
        return;
      }
      withNote = { ...opts, note: String(reason).trim() };
    }
    if (status === 'delivered' && !window.confirm(`Mark order ${order.id} as delivered?`)) return;
    if (status === 'shipped' && !withNote.trackingNo) return;
    updateOrderStatus(order.id, status, statusMeta(status).label, {
      ...withNote,
      by: { uid: user.id, name: user.name || user.email, role: user.role },
    });
    setTracking({ courier: '', trackingNo: '', open: false });
  };

  // ── Razorpay refund (admin action) ─────────────────────────
  // Refunds the captured payment back to the customer's original
  // payment method. Enabled only for real Razorpay payments that
  // have not been refunded yet.
  const payRef = String(order?.payment?.ref || '');
  const canRefund = Boolean(
    order &&
    isStaff &&
    order.payment?.gateway === 'Razorpay' &&
    payRef.startsWith('pay_') &&
    (!order.refundInfo || order.refundInfo.refundStatus === 'failed')
  );

  const refundPayment = async () => {
    if (!order || refunding || !payRef.startsWith('pay_')) return;
    if (!window.confirm(`Refund ${formatINR(order.total)} for order ${order.id}?\n\nThe money returns to the customer's original payment method in 3-7 working days.`)) return;
    setRefunding(true);
    setRefundMsg('');
    try {
      const res = await fetch('/api/razorpay?action=refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, paymentRef: payRef, amount: order.total }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.refunded) {
        const msg = data.error || data.message || 'Refund failed.';
        // Razorpay reports "already refunded" when the money is already
        // back with the customer. Mark the order refunded instead of
        // surfacing a hard error so the UI stops showing "refunding".
        if (/already.*refund/i.test(String(msg)) || /refund.*already/i.test(String(msg))) {
          markOrderRefunded(order.id, {
            type: 'razorpay_refund',
            refundId: order.refundInfo?.refundId || null,
            refundedAt: new Date().toISOString(),
            by: user.name || user.email || 'staff',
            refundStatus: 'refunded',
            note: 'This order was already refunded to the original payment method.',
            gatewayStatus: 'processed',
          });
          setRefundMsg('This order was already refunded to the customer.');
          return;
        }
        throw new Error(msg);
      }
      const rzStatus = String(data.status || '').toLowerCase();
      const refundStatus = (rzStatus === 'processed' || rzStatus === 'refunded') ? 'refunded' : 'refunding';
      markOrderRefunded(order.id, {
        type: 'razorpay_refund',
        refundId: data.refundId || null,
        refundedAt: new Date().toISOString(),
        by: user.name || user.email || 'staff',
        refundStatus,
        note: refundStatus === 'refunded'
          ? 'Amount refunded to the original payment method.'
          : 'Refund initiated — the money will be credited back to the same account in 3-7 working days.',
        gatewayStatus: data.status || null,
      });
      setRefundMsg(refundStatus === 'refunded'
        ? `Refund completed (ID: ${data.refundId || 'pending'}).`
        : `Refund initiated (ID: ${data.refundId || 'pending'}). The customer receives the money in 3-7 working days.`);
    } catch (err) {
      setRefundMsg(err.message || 'Refund failed.');
    } finally {
      setRefunding(false);
    }
  };

  // ── Auto-fetch refund status from Razorpay ─────────────────
  // The "Amount Refunded" state must come from Razorpay, never from a
  // manual admin click. Poll Razorpay for the real refund status and
  // apply it (markOrderRefunded flips the order to "Amount Refunded"
  // once Razorpay reports processed/refunded).
  const refreshRefundStatus = async () => {
    if (!order?.refundInfo || refundChecking) return;
    const payRef = String(order?.payment?.ref || '');
    const refundId = order.refundInfo.refundId || null;
    if (!refundId && !payRef.startsWith('pay_')) return;
    setRefundChecking(true);
    setRefundMsg('');
    try {
      const res = await fetch('/api/razorpay?action=refund-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, paymentRef: payRef, refundId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.error) setRefundMsg(data.error);
        return;
      }
      if (!data.status) return;
      const rzStatus = String(data.status).toLowerCase();
      const newStatus =
        rzStatus === 'processed' || rzStatus === 'refunded'
          ? 'refunded'
          : rzStatus === 'failed'
          ? 'failed'
          : 'refunding';
      const current = refundState(order);
      // Only advance — never downgrade or duplicate the terminal state.
      if (newStatus === current && !(newStatus === 'refunded' && order.status !== 'refunded')) {
        setRefundMsg(`Refund status unchanged: ${rzStatus}.`);
        return;
      }
      markOrderRefunded(order.id, {
        type: 'razorpay_refund',
        refundId: data.refundId || refundId,
        gatewayStatus: data.status,
        refundedAt:
          newStatus === 'refunded'
            ? order.refundInfo.refundedAt || new Date().toISOString()
            : order.refundInfo.refundedAt,
        by: 'Razorpay (auto)',
        refundStatus: newStatus,
        note:
          newStatus === 'refunded'
            ? 'Amount refunded to the original payment method (verified with Razorpay).'
            : newStatus === 'failed'
            ? 'Refund failed according to Razorpay — contact support.'
            : 'Refund in process (verified with Razorpay).',
      });
      setRefundMsg(
        newStatus === 'refunded'
          ? 'Refund confirmed by Razorpay.'
          : newStatus === 'failed'
          ? 'Refund failed according to Razorpay.'
          : 'Refund still processing.'
      );
    } catch (err) {
      setRefundMsg(err.message || 'Could not check refund status.');
    } finally {
      setRefundChecking(false);
    }
  };

  // Auto-check Razorpay whenever a refund is in flight.
  useEffect(() => {
    if (!order || !isStaff || !order.refundInfo) return;
    if (refundState(order) === 'refunded' && order.status === 'refunded') return;
    refreshRefundStatus();
    const timer = setInterval(refreshRefundStatus, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.refundInfo?.refundId, order?.refundInfo?.refundStatus, order?.status, isStaff]);

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
              <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => downloadInvoicePdf(order, settings)}>
                ⬇ Download Invoice
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
              {order.customer?.email && <p className="muted tiny">{order.customer.email}</p>}
              {order.customerEmail && order.customerEmail !== order.customer?.email && <p className="muted tiny">{order.customerEmail}</p>}
              <p className="muted">
                {order.shipping?.address}, {order.shipping?.city}, {order.shipping?.state} — {order.shipping?.pincode}
              </p>
              <ul className="sum-items">
                {order.items.map((it, idx) => (
                  <li key={it.id || idx} style={{ alignItems: 'center' }}>
                    {it.image ? (
                      <img
                        src={it.image}
                        alt={it.name || 'Product'}
                        style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                      />
                    ) : null}
                    <span style={{ flex: 1 }}>
                      {it.name}{(it.colorName || it.color) ? ` (${it.colorName || it.color})` : ''}{it.size ? ` (Size ${it.size})` : ''} × {it.qty}
                    </span>
                    <span className="muted">{formatINR(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              {(order.discount > 0 || order.couponCode) && (
                <div className="sum-lines" style={{ marginTop: 8 }}>
                  {order.discount > 0 && <div><span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>-{formatINR(order.discount)}</span></div>}
                </div>
              )}
            </div>
            <div className="card-box inner">
              <h3>Payment</h3>
              <p>
                <strong>{order.payment?.mode}</strong>
              </p>
              {order.payment?.gateway && <p className="muted tiny">{order.payment.gateway}</p>}
              {order.payment?.ref && <p className="muted tiny">Ref: {order.payment.ref}</p>}
              <div className="sum-lines">
                <div><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
                <div><span>Shipping</span><span>{order.shippingFee > 0 ? formatINR(order.shippingFee) : 'FREE'}</span></div>
                <div><span>Total</span><span>{formatINR(order.total)}</span></div>
              </div>
              {canRefund && (
                <button
                  type="button"
                  className="btn btn-sm danger"
                  style={{ marginTop: 8 }}
                  disabled={refunding}
                  onClick={refundPayment}
                >
                  {refunding ? 'Refunding...' : `Refund ${formatINR(order.total)} to customer`}
                </button>
              )}
              {order.refundInfo && (refundState(order) === 'refunding' || refundState(order) === 'failed') && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginTop: 8, marginLeft: 8 }}
                  onClick={refreshRefundStatus}
                  disabled={refundChecking}
                >
                  {refundChecking ? 'Checking…' : '↻ Check refund status'}
                </button>
              )}
              {refundMsg && (
                <p
                  className={`tiny ${refundMsg.startsWith('Refund initiated') ? 'ok' : 'error'}`}
                  style={{ marginTop: 6 }}
                >
                  {refundMsg}
                </p>
              )}
              {order.refundInfo && (
                <p className="muted tiny" style={{ marginTop: 6 }}>
                  Refund:{' '}
                  {refundState(order) === 'refunding'
                    ? 'Refunding in process'
                    : refundState(order) === 'refunded'
                    ? 'Refunded'
                    : order.refundInfo.refundStatus === 'failed'
                    ? 'Refund failed — contact support'
                    : order.refundInfo.note || '—'}
                  {order.refundInfo.refundId ? ` (ID: ${order.refundInfo.refundId})` : ''}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {invoiceOrder && (
        <ManageInvoiceModal order={invoiceOrder} settings={settings} onClose={() => setInvoiceOrder(null)} />
      )}
    </main>
  );
}

function ManageInvoiceModal({ order, settings, onClose }) {
  const [url, setUrl] = useState('');
  React.useEffect(() => {
    let u = null;
    let alive = true;
    invoicePdfUrl(order, settings).then((v) => {
      if (!alive) { URL.revokeObjectURL(v); return; }
      u = v;
      setUrl(v);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [order, settings]);
  if (!order) return null;
  return (
    <PdfViewer
      title={`Invoice — ${order.id}`}
      subtitle={`${formatDateTime(order.orderDate)} · ${formatINR(order.total)}`}
      url={url}
      fileName={`invoice-${order.id || 'download'}.pdf`}
      onDownload={() => downloadInvoicePdf(order, settings)}
      onPrint={() => printInvoicePdf(order, settings)}
      onClose={onClose}
    />
  );
}
