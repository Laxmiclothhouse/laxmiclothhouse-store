// ─────────────────────────────────────────────────────────────
// api/send-order-mail.js — Sends a transactional order e-mail.
// Guarded so an order can only ever be mailed to its own customer.
// Gracefully skips sending when RESEND_API_KEY is not configured.
// ─────────────────────────────────────────────────────────────
import { sendOrderMail } from '../shared/mail.mjs';

const VALID_TYPES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, to } = req.body || {};
    const order = req.body?.order || {};
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid mail type' });
    }

    const orderEmail = String(order.customerEmail || order.customer?.email || '').trim().toLowerCase();
    const target = String(to || '').trim().toLowerCase();

    // The recipient MUST be the order's own customer (stops address-bombing).
    if (!orderEmail || target !== orderEmail) {
      return res.status(400).json({ error: 'Recipient does not match the order' });
    }
    if (!order.id) {
      return res.status(400).json({ error: 'Order id required' });
    }

    const result = await sendOrderMail({ type, to: target, order });
    if (result.error) console.error('send-order-mail: customer send failed:', result.error);
    if (result.merchantError) console.error('send-order-mail: merchant copy failed:', result.merchantError);
    res.json({
      ok: result.ok === true,
      skipped: result.skipped === true,
      customerSent: result.customerSent === true,
      merchantSent: result.merchantSent === true,
      error: result.error || null,
      merchantError: result.merchantError || null,
    });
  } catch (err) {
    console.error('send-order-mail error:', err);
    res.status(500).json({ error: 'Failed to send mail' });
  }
}