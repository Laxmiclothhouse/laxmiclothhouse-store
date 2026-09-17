// ─────────────────────────────────────────────────────────────
// api/update-order-status.js — Server-side audit + guard for staff
// status changes, and dispatches the shipped/delivered/cancelled
// e-mails. The client updates its local store FIRST (so the store
// never depends on this), then calls this endpoint best-effort.
// Upgrade path: once FIREBASE_SERVICE_ACCOUNT is configured, this
// endpoint can also verify Firebase ID tokens and write Firestore
// server-side.
// ─────────────────────────────────────────────────────────────
import { sendOrderMail } from '../shared/mail.mjs';

const TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const MAIL_TYPES = {
  placed: 'placed',
  confirmed: 'confirmed',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'returned',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, status, label, note = '', trackingNo = '', courier = '', previousStatus, by = {}, orderInfo } = req.body || {};

    if (!orderId || !status) {
      return res.status(400).json({ error: 'orderId and status are required' });
    }

    const role = String(by.role || '').toLowerCase();
    const staff = ['admin', 'manager', 'packer', 'shipper', 'support'].includes(role);

    // Server-side workflow guard (mirrors the UI rules).
    if (staff) {
      const from = String(previousStatus || '').toLowerCase() === 'paid' ? 'confirmed' : String(previousStatus || '');
      const allowed = TRANSITIONS[from] || [];
      const permit =
        role === 'admin' || role === 'manager'
          ? allowed.includes(status)
          : (role === 'packer' && status === 'packed') ||
            (role === 'shipper' && status === 'shipped');
      if (!permit) {
        return res.status(403).json({ error: 'Transition not allowed for this role' });
      }
    }

    // Tracked shipments must carry a tracking number.
    if (status === 'shipped' && !String(trackingNo).trim()) {
      return res.status(400).json({ error: 'Tracking number is required to mark shipped' });
    }

    // Immutable audit trail (currently Vercel logs; extend with Firestore later).
    console.log('[audit]', JSON.stringify({
      orderId,
      status,
      label: label || status,
      note,
      trackingNo,
      courier,
      previousStatus,
      by,
      at: new Date().toISOString(),
    }));

    // Dispatch the matching customer e-mail when the order snapshot is supplied.
    const mailType = MAIL_TYPES[status];
    if (mailType && orderInfo && orderInfo.customerEmail) {
      const mailed = await sendOrderMail({
        type: mailType,
        to: orderInfo.customerEmail,
        order: { ...orderInfo, trackingNo, courier },
      });
      if (!mailed.ok) {
        console.error('[update-order-status] customer mail failed:', mailed.error, '->', orderInfo.customerEmail);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('update-order-status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
}