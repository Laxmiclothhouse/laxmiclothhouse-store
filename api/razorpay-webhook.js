// ─────────────────────────────────────────────────────────────
// api/razorpay-webhook.js — Razorpay refund lifecycle webhook.
//
// Razorpay calls this URL (configured in the Razorpay Dashboard →
// Settings → Webhooks) whenever a refund changes state. We care
// about:
//   refund.processed  → money has reached the customer; mark the
//                       order's refund as "refunded".
//   refund.failed     → refund could not complete; mark it "failed".
//   refund.created    → refund initiated (belt-and-suspenders: keep
//                       the customer-facing state as "refunding").
//
// Security: the request is signed by Razorpay using the webhook
// secret. We verify the X-Razorpay-Signature header against the
// RAW request body (must not be re-serialised) using an HMAC.
//
// Setup: in Vercel → Settings → Environment Variables add
//   RAZORPAY_WEBHOOK_SECRET = <the secret shown when you create
//                             the webhook in the Razorpay dashboard>
// then create a webhook in Razorpay pointing to
//   https://<your-domain>/api/razorpay-webhook
// with these events: refund.processed, refund.failed, refund.created.
// ─────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { getOrdersDoc, patchOrdersDoc } from '../shared/firestoreRest.mjs';

const WEBHOOK_SECRET = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

// Map a Razorpay refund event → the refundStatus we store on the order.
const EVENT_STATUS = {
  'refund.processed': 'refunded',
  'refund.failed': 'failed',
  'refund.created': 'refunding',
};

// Razorpay's signature is an HMAC over the RAW request body, so the
// body parser must be disabled — otherwise Vercel re-serialises the
// JSON and the signature will never match.
export const config = {
  api: { bodyParser: false },
};

// Razorpay gives us the raw body as a Buffer when the body parser is
// disabled for this route; fall back to the stringified body.
function rawBody(req) {
  if (req.body == null) return '';
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body);
}

function verifySignature(raw, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = rawBody(req);
  const signature = req.headers['x-razorpay-signature'];

  if (!WEBHOOK_SECRET) {
    console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!verifySignature(raw, signature)) {
    console.warn('[razorpay-webhook] invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const event = String(payload.event || '');
  const refundStatus = EVENT_STATUS[event];
  if (!refundStatus) {
    // Not an event we act on — acknowledge so Razorpay stops retrying.
    return res.status(200).json({ ok: true, ignored: event });
  }

  const refundEntity = payload?.payload?.refund?.entity || {};
  const paymentId = String(refundEntity.payment_id || '');
  const refundId = refundEntity.id || null;
  if (!paymentId) {
    return res.status(200).json({ ok: true, ignored: 'no payment_id' });
  }

  // Orders live in a single Firestore document: store/orders → { data: [...] }.
  const doc = await getOrdersDoc();
  if (!doc.ok) {
    console.error('[razorpay-webhook] orders read failed:', doc.error);
    return res.status(500).json({ error: 'Could not read orders' });
  }

  const orders = Array.isArray(doc.data) ? doc.data : [];
  // Match by the captured Razorpay payment id stored on the order.
  const target = orders.find((o) => String(o?.payment?.ref || '') === paymentId);
  if (!target) {
    console.warn('[razorpay-webhook] no order for payment', paymentId);
    return res.status(200).json({ ok: true, matched: 0 });
  }

  // Only advance a cancelled order's refund state; never downgrade a
  // refund that is already further along (e.g. don't turn refunded→failed).
  const rank = { failed: 0, refunding: 1, refunded: 2 };
  const currentRank = rank[target.refundInfo?.refundStatus] ?? -1;
  const newRank = rank[refundStatus] ?? -1;
  if (newRank <= currentRank) {
    return res.status(200).json({ ok: true, unchanged: true });
  }

  const next = orders.map((o) =>
    o.id === target.id
      ? {
          ...o,
          refundInfo: {
            ...(o.refundInfo || {}),
            refundStatus,
            refundId: refundId || o.refundInfo?.refundId || null,
            gatewayStatus: refundEntity.status || null,
            refundedAt: refundStatus === 'refunded' ? new Date().toISOString() : o.refundInfo?.refundedAt || new Date().toISOString(),
          },
        }
      : o
  );

  const written = await patchOrdersDoc(next);
  if (!written.ok) {
    console.error('[razorpay-webhook] orders write failed:', written.error);
    return res.status(500).json({ error: 'Could not update order' });
  }

  console.log(`[razorpay-webhook] ${event}: order ${target.id} → ${refundStatus} (refund ${refundId || '-'})`);
  return res.status(200).json({ ok: true, orderId: target.id, refundStatus });
}
