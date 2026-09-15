// ─────────────────────────────────────────────────────────────
// shared/whatsapp.mjs — WhatsApp order notifications via
// Twilio WhatsApp API.
//
// Env vars (set in Vercel):
//   TWILIO_ACCOUNT_SID  — from Twilio Console (starts with AC...)
//   TWILIO_AUTH_TOKEN   — from Twilio Console (starts with ...)
//   TWILIO_WHATSAPP_FROM — Twilio WhatsApp sender number (e.g. whatsapp:+14155229999)
//   APP_ORIGIN          — your app URL (default below)
// ─────────────────────────────────────────────────────────────

import twilio from 'twilio';

const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID  || '';
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN   || '';
const FROM_NUMBER  = process.env.TWILIO_WHATSAPP_FROM || '';
const APP_ORIGIN   = process.env.APP_ORIGIN || 'https://online-store-sigma-three.vercel.app';

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// ── Message templates ──────────────────────────────────────────

export function renderWhatsApp(type, orderRaw) {
  const o  = orderRaw || {};
  const id = o.id || '';
  const name = o.customerName || 'there';
  const total = money(o.total);
  const mode  = o.paymentMode || 'online';
  const track = `${APP_ORIGIN}/#/order-manage/${encodeURIComponent(id || '')}`;

  const COPY = {
    placed:    `Order Placed - ${id}\n\nHi ${name}! We have received your order.\n\nTotal: ${total}\nPayment: ${mode}\n\nTrack: ${track}`,
    confirmed: `Order Confirmed - ${id}\n\nHi ${name}! Your order has been confirmed.\n\nTotal: ${total}`,
    packed:    `Order Packed - ${id}\n\nHi ${name}! Your order has been packed and will ship soon.`,
    shipped:   `Order Shipped - ${id}\n\nHi ${name}! Your order is on the way!${o.trackingNo ? `\nTracking: ${o.trackingNo}` : ''}`,
    delivered: `Order Delivered - ${id}\n\nHi ${name}! Your order has been delivered.`,
    cancelled: `Order Cancelled - ${id}\n\nHi ${name}, your order has been cancelled.`,
    returned:  `Return Processed - ${id}\n\nHi ${name}, your return has been processed.`,
  };

  return COPY[type] || COPY.placed;
}

// ── Core send function ─────────────────────────────────────────

export async function sendWhatsApp({ to, type, order }) {
  const phone = String(to || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    console.log('[whatsapp] FAIL: invalid phone', phone);
    return { ok: false, error: 'invalid-phone' };
  }

  // Twilio WhatsApp uses +<country><number> format with "whatsapp:" prefix
  const fullPhone = phone.startsWith('91') && phone.length === 12 ? phone : '91' + phone;
  const toWhatsapp = `whatsapp:+${fullPhone}`;
  const fromWhatsapp = FROM_NUMBER; // e.g. "whatsapp:+14155229999"

  if (!ACCOUNT_SID) {
    console.log('[whatsapp] FAIL: no TWILIO_ACCOUNT_SID set');
    return { ok: false, error: 'no-account-sid' };
  }
  if (!AUTH_TOKEN) {
    console.log('[whatsapp] FAIL: no TWILIO_AUTH_TOKEN set');
    return { ok: false, error: 'no-auth-token' };
  }
  if (!FROM_NUMBER) {
    console.log('[whatsapp] FAIL: no TWILIO_WHATSAPP_FROM set');
    return { ok: false, error: 'no-from-number' };
  }

  const message = renderWhatsApp(type, order);

  console.log('[whatsapp] ATTEMPT:', { type, to: toWhatsapp, from: fromWhatsapp });

  try {
    const messageObj = await client.messages.create({
      from:    fromWhatsapp,
      to:      toWhatsapp,
      body:    message,
      // mediaUrl: [],  // optional — add images later if needed
    });

    console.log('[whatsapp] SUCCESS:', {
      sid:      messageObj.sid,
      status:   messageObj.status,
      dateSent: messageObj.dateSent,
    });

    return {
      ok: true,
      result: {
        msgId:    messageObj.sid,
        status:   messageObj.status,
        mediaUrl: messageObj.mediaUrl || [],
      },
    };
  } catch (err) {
    console.error('[whatsapp] TWILIO ERROR:', err.message);
    // Twilio errors often include a detailed error body
    const details = err.message || String(err);
    return { ok: false, error: 'twilio-send-failed', details };
  }
}

// ── Helper: wa.me link ────────────────────────────────────────

export function buildWhatsAppLink(text, phone = '') {
  const msg = encodeURIComponent(String(text || ''));
  if (phone) {
    const p = String(phone).replace(/\D/g, '');
    return `https://wa.me/${p}?text=${msg}`;
  }
  return `https://wa.me/?text=${msg}`;
}

// ── Helper: share texts ───────────────────────────────────────

export function productShareText(product) {
  const name  = product.name || 'this product';
  const price = money(product.price || 0);
  const url   = `${APP_ORIGIN}/#/product/${product.id || ''}`;
  return `Check out ${name} (${price}): ${url}`;
}

export function orderShareText(order) {
  const id   = order.id || '';
  const url  = `${APP_ORIGIN}/#/order-status?order=${encodeURIComponent(id)}`;
  return `My order ${id}: ${url}`;
}

