// ─────────────────────────────────────────────────────────────
// api/refund.js — refund a captured Razorpay payment (server-side).
// Mirrors the /api/refund route from server.js so the DEPLOYED site
// (Vercel) can refund too: Vercel only runs files inside /api.
//
// Body: { orderId, paymentRef, amount }
// Razorpay credits the money back to the customer's ORIGINAL payment
// source (UPI / card / netbanking) in 3-7 working days.
// ─────────────────────────────────────────────────────────────
import Razorpay from 'razorpay';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TYAM6GyacLBRrL';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'qAB5XlUf0AoZ2OjJXoZv4nvJ';

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ refunded: false, error: 'Method not allowed' });
  }

  try {
    const { orderId, paymentRef, amount } = req.body || {};
    if (!orderId || !paymentRef || !amount) {
      return res.status(400).json({ refunded: false, error: 'Missing orderId, paymentRef, or amount' });
    }

    const amountInRupees = Number(amount);
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ refunded: false, error: 'Invalid amount' });
    }

    // Only real captured Razorpay payments can be refunded (ref looks like pay_xxx).
    if (!String(paymentRef).startsWith('pay_')) {
      return res.json({
        refunded: false,
        reason: 'no_online_payment',
        message: 'No Razorpay payment to refund. This order was COD or a demo payment - no money was charged.',
      });
    }

    const refund = await razorpay.payments.refund(paymentRef, {
      amount: Math.round(amountInRupees * 100), // paise
      receipt: 'refund_' + String(orderId),
      notes: { orderId: String(orderId) },
    });

    console.log('[refund] success:', refund.id, refund.status, 'order', orderId);
    return res.json({
      refunded: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      message: 'Refund initiated. The money will be credited back to your account in 5-7 working days.',
    });
  } catch (err) {
    const message =
      err?.error?.description ||
      err?.details?.description ||
      err?.response?.description ||
      err?.message ||
      'Refund failed';
    console.error('refund error:', message);
    return res.status(500).json({ refunded: false, reason: 'refund_failed', error: message, message });
  }
}
