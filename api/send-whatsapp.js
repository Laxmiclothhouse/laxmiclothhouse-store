// WhatsApp order notification API endpoint.
import { sendWhatsApp } from '../shared/whatsapp.mjs';

const VALID_TYPES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { type, to } = req.body || {};
    const order = req.body?.order || {};
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid message type' });
    if (!order.id) return res.status(400).json({ error: 'Order id required' });

    // Get phone from either the 'to' field or order object
    const target = String(to || order.customerPhone || order.customer?.phone || order.phone || '').replace(/\D/g, '');
    if (!target || target.length < 10) return res.status(400).json({ error: 'Valid phone number required' });

    console.log('[whatsapp] sending', type, 'to', target, 'for order', order.id);
    const result = await sendWhatsApp({ type, to: target, order });
    console.log('[whatsapp] result:', JSON.stringify(result));
    res.json({ ok: true, skipped: result.skipped === true, result });
  } catch (err) {
    console.error('send-whatsapp error:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp message: ' + err.message });
  }
}
