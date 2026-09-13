// WhatsApp order notification API endpoint.
import { sendWhatsApp } from '../shared/whatsapp.mjs';

const VALID_TYPES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { type, to } = req.body || {};
    const order = req.body?.order || {};
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid message type' });
    const orderPhone = String(order.customerPhone || order.customer?.phone || '').replace(/\D/g, '');
    const target = String(to || '').replace(/\D/g, '');
    if (!orderPhone || target !== orderPhone) return res.status(400).json({ error: 'Recipient does not match the order' });
    if (!order.id) return res.status(400).json({ error: 'Order id required' });
    const result = await sendWhatsApp({ type, to: target, order });
    res.json({ ok: true, skipped: result.skipped === true });
  } catch (err) {
    console.error('send-whatsapp error:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
}
